#!/bin/bash
# Script tạo icons cho PWA từ SVG
# Cần cài: npm install -g svgexport
# Hoặc dùng online tool: https://realfavicongenerator.net

# Sizes cần thiết cho PWA
SIZES="72 96 128 144 152 192 384 512"

echo "Tạo icons cho PWA..."
echo "Bạn có thể dùng 1 trong các cách sau:"
echo ""
echo "1. Online tool (dễ nhất):"
echo "   - Vào https://realfavicongenerator.net"
echo "   - Upload file favicon.svg"
echo "   - Download và giải nén vào thư mục public/icons/"
echo ""
echo "2. Dùng Figma/Canva:"
echo "   - Tạo icon 512x512px"
echo "   - Export các size: $SIZES"
echo "   - Đặt tên: icon-72x72.png, icon-96x96.png, ..."
echo ""
echo "3. Dùng ImageMagick (nếu đã cài):"
echo "   for size in $SIZES; do"
echo "     convert -background none -resize \${size}x\${size} favicon.svg icon-\${size}x\${size}.png"
echo "   done"
