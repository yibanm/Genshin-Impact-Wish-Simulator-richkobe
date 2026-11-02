#!/bin/bash
# 8 路真并发分片下载 GitHub artifact。
# 适用条件（实测结论，见全局经验 2026-11-02 下载提速条目）：仅当通道是「每连接限速」时并发才有效；
# 本机经代理访问 GitHub blob 是「总带宽限速」，8 路总吞吐与单连接持平（≈0.28MB/s），此脚本对本通道无收益，
# 默认走串行续传循环。换通道（直连/其他镜像）前先用本脚本与单连接各测 60 秒持续吞吐再选。
# 用法：bash scripts/parallel-download.sh <artifact_id> <输出路径>
set -u
ARTIFACT_ID="$1"
OUT="$2"
REPO="yibanm/Genshin-Impact-Wish-Simulator-richkobe"
PROXY="http://127.0.0.1:7897"
PARTS=8
TMPD="$OUT.parts"

TOKEN=$(cat "/d/1Tools/keys/github-token.txt" | tr -d '[:space:]')
URL="https://api.github.com/repos/$REPO/actions/artifacts/$ARTIFACT_ID/zip"

TOTAL=$(curl -sIL --max-time 60 -x "$PROXY" -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" "$URL" | tr -d '\r' | grep -i '^content-length:' | tail -1 | awk '{print $2}')
if [ -z "$TOTAL" ] || [ "$TOTAL" -lt 1000 ]; then
  echo "FAIL: 拿不到 content-length ($TOTAL)"
  unset TOKEN
  exit 1
fi
echo "总大小: $TOTAL 字节，分 $PARTS 片真并发"

rm -rf "$TMPD"
mkdir -p "$TMPD"
CHUNK=$(( (TOTAL + PARTS - 1) / PARTS ))

pids=()
for i in $(seq 0 $((PARTS-1))); do
  START=$(( i * CHUNK ))
  END=$(( START + CHUNK - 1 ))
  [ "$END" -ge "$TOTAL" ] && END=$(( TOTAL - 1 ))
  [ "$START" -gt "$END" ] && continue
  curl -sL --retry 3 --retry-delay 3 --max-time 560 -x "$PROXY" \
    -H "Authorization: token $TOKEN" -H "Accept: application/vnd.github+json" \
    -r "$START-$END" -o "$TMPD/part$(printf %02d $i)" "$URL" &
  pids+=($!)
done

FAIL=0
for p in "${pids[@]}"; do
  wait "$p" || FAIL=1
done
unset TOKEN

if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: 有分片 curl 退出非零"
  ls -l "$TMPD"
  exit 1
fi

# 校验每片大小
i=0
for f in "$TMPD"/part*; do
  START=$(( i * CHUNK ))
  EXPECT=$CHUNK
  NEXT=$(( START + CHUNK ))
  [ "$NEXT" -gt "$TOTAL" ] && EXPECT=$(( TOTAL - START ))
  GOT=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")
  if [ "$GOT" != "$EXPECT" ]; then
    echo "FAIL: $(basename $f) got=$GOT want=$EXPECT"
    exit 1
  fi
  i=$(( i + 1 ))
done
echo "全部 $i 片大小校验通过"

cat "$TMPD"/part* > "$OUT"
rm -rf "$TMPD"

node -e "
const fs=require('fs');
const b=fs.readFileSync('$OUT');
let e=false;
for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--){if(b.readUInt32LE(i)===0x06054b50){e=true;break;}}
console.log('拼接: '+b.length+' 字节 (期望 $TOTAL) | EOCD: '+(e?'有效':'无效'));
console.log(e && b.length===$TOTAL ? '结论: PASS' : '结论: FAIL');
process.exit(e && b.length===$TOTAL ? 0 : 1);
"
