#!/bin/bash

set -e

WINE_PREFIX="${WINEPREFIX:-$HOME/.wine}"
HNC_BIN="$WINE_PREFIX/drive_c/Program Files (x86)/Hnc/Office 2024/HOffice130/Bin"

echo "=== 한글 2024 Wine 패치 시작 ==="
echo "WINE PREFIX: $WINE_PREFIX"
echo ""

# 경로 확인
if [ ! -d "$HNC_BIN" ]; then
    echo "[오류] 한글 설치 경로를 찾을 수 없습니다: $HNC_BIN"
    echo "WINEPREFIX 환경변수를 설정하거나 설치 경로를 확인하세요."
    exit 1
fi

install_package() {
    local pkg="$1"
    echo "  [$pkg] 설치 중..."
    if command -v apt-get &>/dev/null; then
        sudo apt-get install -y "$pkg"
    elif command -v dnf &>/dev/null; then
        sudo dnf install -y "$pkg"
    elif command -v pacman &>/dev/null; then
        sudo pacman -S --noconfirm "$pkg"
    elif command -v zypper &>/dev/null; then
        sudo zypper install -y "$pkg"
    elif command -v emerge &>/dev/null; then
        sudo emerge "$pkg"
    else
        echo "  [오류] 지원하는 패키지 매니저를 찾을 수 없습니다. $pkg 를 수동으로 설치하세요."
        return 1
    fi
}

# 소캇 설치확인
echo "[1/6] socat 확인..."
if ! command -v socat &>/dev/null; then
    echo "  socat 미설치, 설치합니다..."
    install_package socat
else
    echo "  socat 이미 설치됨: $(which socat)"
fi

echo "[2/6] xdg-open 래퍼 생성..."
cat > /tmp/xdg-open.sh << 'EOF'
#!/bin/bash
xdg-open "$@"
EOF
chmod +x /tmp/xdg-open.sh
echo "  성공: /tmp/xdg-open.sh"

ENGINE_DLL="$HNC_BIN/HncOfficeEngine.dll"

echo "[3/6] HncOfficeEngine.dll 패치 중..."
if [ ! -f "$ENGINE_DLL" ]; then
    echo "  [경고] 파일 없음, 건너뜀"
else
    if [ ! -f "$ENGINE_DLL.bak" ]; then
        cp "$ENGINE_DLL" "$ENGINE_DLL.bak"
        echo "  백업 성공: HncOfficeEngine.dll.bak"
    else
        echo "  백업 이미 존재, 덮어쓰지 않음"
    fi

    python3 - "$ENGINE_DLL" << 'PYEOF'
import sys
dll = sys.argv[1]
with open(dll, 'r+b') as f:
    # 0x319b4: 6a 00 6a 00 e8 d6 58 0b 00 cc → NOP x10
    f.seek(0x319b4)
    f.write(bytes([0x90] * 10))

    # 0x322d0: 빈 std::string 반환 패치
    # __cdecl: [ebp+8] = std::string* 출력 버퍼
    patch = bytes([
        0x55,                    # push ebp
        0x8b, 0xec,              # mov ebp, esp
        0x8b, 0x45, 0x08,        # mov eax, [ebp+8]
        0x33, 0xd2,              # xor edx, edx
        0x89, 0x10,              # mov [eax], edx       (ptr = null)
        0x89, 0x50, 0x04,        # mov [eax+4], edx     (size = 0)
        0xc7, 0x40, 0x08,        # mov dword [eax+8], 15 (capacity = 15)
        0x0f, 0x00, 0x00, 0x00,
        0x5d,                    # pop ebp
        0xc2, 0x04, 0x00,        # ret 4
    ])
    f.seek(0x322d0)
    f.write(patch)

print("  HncOfficeEngine.dll 패치 성공")
PYEOF
fi
MODULE_DLL="$HNC_BIN/HncOfficeModule.dll"

echo "[4/6] HncOfficeModule.dll 패치 중..."
if [ ! -f "$MODULE_DLL" ]; then
    echo "  [경고] 파일 없음, 건너뜀"
else
    if [ ! -f "$MODULE_DLL.bak" ]; then
        cp "$MODULE_DLL" "$MODULE_DLL.bak"
        echo "  백업 성공: HncOfficeModule.dll.bak"
    else
        echo "  백업 이미 존재, 덮어쓰지 않음"
    fi

    python3 - "$MODULE_DLL" << 'PYEOF'
import sys
dll = sys.argv[1]
with open(dll, 'r+b') as f:
    # 0x3342b: NOP x15 + RET
    f.seek(0x3342b)
    f.write(bytes([0x90] * 15 + [0xc3]))

    # 0x333fe: NOP x15 + RET
    f.seek(0x333fe)
    f.write(bytes([0x90] * 15 + [0xc3]))

    # 0x1659c: .NET IL ldnull + ret (패치 먼저)
    patch = bytes([
        0x14,                    # ldnull
        0x2a,                    # ret
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ])
    f.seek(0x1659c)
    f.write(patch)

    # .NET Fat 헤더 code_size = 2 (flags(2)+max_stack(2) 다음 4바이트)
    f.seek(0x16590 + 4)
    f.write((2).to_bytes(4, 'little'))

# 확인
with open(dll, 'rb') as f:
    f.seek(0x333fe)
    print(f"  0x333fe 확인: {f.read(16).hex()}")
    f.seek(0x1659c)
    print(f"  0x1659c 확인: {f.read(4).hex()}")

print("  HncOfficeModule.dll 패치 성공")
PYEOF
fi

echo "[5/6] 보안관련 프로세스 비활성화..."

disable_file() {
    local path="$1"
    if [ -f "$path" ] && [ ! -f "$path.bak" ]; then
        mv "$path" "$path.bak"
        echo "  비활성화: $(basename "$path")"
    elif [ -f "$path.bak" ]; then
        echo "  이미 비활성화됨: $(basename "$path")"
    else
        echo "  없음(건너뜀): $(basename "$path")"
    fi
}

disable_file "$HNC_BIN/A3DT.exe"
disable_file "$HNC_BIN/A3Dll32.dll"

echo "[6/6] Wine 레지스트리 및 socat 설정..."

wine reg add "HKEY_CLASSES_ROOT\http\shell\open\command" \
    /ve /t REG_SZ /d "xdg-open \"%1\"" /f > /dev/null 2>&1
echo "  http 핸들러 등록 성공"

wine reg add "HKEY_CLASSES_ROOT\https\shell\open\command" \
    /ve /t REG_SZ /d "xdg-open \"%1\"" /f > /dev/null 2>&1
echo "  https 핸들러 등록 성공"

if ! pgrep -f "socat.*TCP-LISTEN:80" > /dev/null 2>&1; then
    sudo sysctl -w net.ipv4.ip_unprivileged_port_start=0 > /dev/null 2>&1 || true
    socat TCP-LISTEN:80,fork,reuseaddr TCP:127.0.0.1:10121 &
    echo "  socat 포트포워딩 시작 (80 → 10121), PID: $!"
else
    echo "  socat 이미 실행 중"
fi

# ────────────────────────────────────────────
echo ""
echo "=== 패치 성공 ==="
echo ""
echo "아직 한컴독스 로그인이 안되있다면 재시작 하지 말고, 지금 한글을 실행해 로그인부터 해주세요!"
