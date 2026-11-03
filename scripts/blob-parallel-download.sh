#!/bin/bash
# 分片并行下载 GitHub artifact 的 blob 静态对象（302 后的 Azure blob）。
# 安全前提：blob 是静态对象，Range 分片字节一致，可逐片续传；
# 「弗兰肯 zip」只发生在 api.github.com 的实时生成端点（每次请求压缩结果不同），
# 本脚本不碰那个端点做续传。
# 用法：bash scripts/blob-parallel-download.sh <artifact_id> <输出路径> [分片数]
set -u
ARTIFACT_ID="$1"
OUT="$2"
PARTS="${3:-8}"
REPO="yibanm/Genshin-Impact-Wish-Simulator-richkobe"
PROXY="http://127.0.0.1:7897"
TMPD="$OUT.blobparts"

TOKEN=$(cat "/d/1Tools/keys/github-token.txt" | tr -d '[:space:]')

# 1. 拿 blob URL（跟随 302，只取地址不下载）
BLOB=$(curl -sIL --max-time 60 -x "$PROXY" -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
  -o /dev/null -w "%{url_effective}" \
  "https://api.github.com/repos/$REPO/actions/artifacts/$ARTIFACT_ID/zip")
unset TOKEN
echo "blob host: $(echo "$BLOB" | cut -d/ -f3)"

# 2. blob 总大小
TOTAL=$(curl -sI --max-time 60 -x "$PROXY" "$BLOB" | tr -d '\r' | grep -i '^content-length:' | tail -1 | awk '{print $2}')
if [ -z "$TOTAL" ] || [ "$TOTAL" -lt 1000 ]; then
  echo "FAIL: 拿不到 blob content-length ($TOTAL)"
  exit 1
fi
echo "blob 总大小: $TOTAL 字节，分 $PARTS 片"

mkdir -p "$TMPD"
CHUNK=$(( (TOTAL + PARTS - 1) / PARTS ))

# 3. 每片独立续传循环（blob 是静态对象，Range 续传字节一致，安全）。
# curl 的 -C - 与 -r 互斥，故手动算偏移：区间从 start+已有大小 起，
# 增量写 .tmp 后追加进 part 文件。
download_part() {
  local i=$1 start=$2 end=$3 expect=$4
  local out="$TMPD/part$(printf %02d $i)"
  for try in $(seq 1 "${TRIES:-60}"); do
    local got=$(stat -c %s "$out" 2>/dev/null || echo 0)
    [ "$got" -ge "$expect" ] && return 0
    local from=$(( start + got ))
    [ "$from" -gt "$end" ] && from=$end
    curl -s --retry 1 --max-time 550 -x "$PROXY" -r "$from-$end" -o "$out.tmp" "$BLOB" || true
    if [ -s "$out.tmp" ]; then
      cat "$out.tmp" >> "$out"
      rm -f "$out.tmp"
    fi
    sleep 2
  done
  return 1
}

pids=()
for i in $(seq 0 $((PARTS-1))); do
  START=$(( i * CHUNK ))
  END=$(( START + CHUNK - 1 ))
  [ "$END" -ge "$TOTAL" ] && END=$(( TOTAL - 1 ))
  [ "$START" -gt "$END" ] && continue
  EXPECT=$(( END - START + 1 ))
  download_part "$i" "$START" "$END" "$EXPECT" &
  pids+=($!)
done

FAIL=0
for p in "${pids[@]}"; do wait "$p" || FAIL=1; done
if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: 有分片未完成"
  ls -l "$TMPD"
  exit 1
fi

# 4. 逐片大小核对
i=0
for f in "$TMPD"/part*; do
  START=$(( i * CHUNK ))
  EXPECT=$CHUNK
  NEXT=$(( START + CHUNK ))
  [ "$NEXT" -gt "$TOTAL" ] && EXPECT=$(( TOTAL - START ))
  GOT=$(stat -c %s "$f")
  if [ "$GOT" != "$EXPECT" ]; then
    echo "FAIL: $(basename $f) got=$GOT want=$EXPECT"
    exit 1
  fi
  i=$(( i + 1 ))
done
echo "全部 $i 片大小核对通过"

# 5. 拼接 + EOCD 校验
cat "$TMPD"/part* > "$OUT"
rm -rf "$TMPD"
node -e "
const fs=require('fs');
const b=fs.readFileSync('$OUT');
let e=false;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50){e=true;break;}}
console.log('拼接: '+b.length+' 字节 (期望 $TOTAL) | EOCD: '+(e?'有效':'无效'));
console.log(e && b.length===$TOTAL ? '结论: PASS' : '结论: FAIL');
process.exit(e && b.length===$TOTAL ? 0 : 1);
"
