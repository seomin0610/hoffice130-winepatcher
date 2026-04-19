# hoffice130 winepatcher

[한컴오피스](https://www.hancom.com) 2024를 wine으로 실행하기 위한 dll 패쳐 입니다.


> [!WARNING]
> 이 패쳐는 dll(동적 링크 라이브러리) 파일을 직접적으로 건드려서,
> 한컴 악성코드 탐지 기능을 사용하실 수 없습니다. 사용에 유의하세요.

## 사전 요구사항

- wine
- socat (한컴독스 로그인시 필요해요)
- winetricks
- 등등..

## 사용법

1. wine으로 윈도우용 한컴오피스를 공식 [설치프로그램](https://cdn.hancom.com/pds/hnc/DOWN/HancomDocs/HancomOffice_HancomDocs_ko.exe)을 통해 설치해주세요.
2. 릴리즈 탭에서 최신 패쳐를 다운로드 받아 사용권한을 부여한뒤, 실행시키면 패치가 시작됩니다

## 테스트된 환경

- wine-11.0 (Staging)
- winetricks 20260125

OS: Fedora Linux 43 (Workstation Edition) x86_64

Kernel: Linux 6.19.9-200.fc43.x86_64

WM: Hyprland 0.54.3 (Wayland)

IME(입력기): fcitx5/kime
