# 生成中文正文兜底字体（2026-11-05）：Noto Sans SC 可变字体实例化 wght=400 并转 woff2。
# 背景：GI_ZH_Web 子集仅 1595 字形，缺「建/义/己/官/样」等常用字，缺字逐字回退系统
# 黑体与 GI 字形混排 = 用户报的「粗细随机」。Noto Sans SC（思源黑体，OFL-1.1）覆盖
# 30890 码点全命中，作为中文栈兜底字体，保证中文单字体族不再混排。
# 用法：py scripts/make-zh-font.py <输入ttf> <输出woff2>
import sys

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src, dst = sys.argv[1], sys.argv[2]
font = TTFont(src)
instancer.instantiateVariableFont(font, {"wght": 400}, inplace=True)
font.flavor = "woff2"
font.save(dst)
print("OK", dst, "glyphs:", font["maxp"].numGlyphs)
