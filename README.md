# hoffice130 winepatcher

[한컴오피스](https://www.hancom.com) 2024를 wine으로 실행하기 위한 dll 패쳐 입니다.


> [!WARNING]
> 이 패쳐는 dll(동적 링크 라이브러리) 파일을 직접적으로 건드려서,
> 한컴 악성코드 탐지 기능을 사용하실 수 없습니다. 사용에 유의하세요.

## 사전 요구사항

- wine
- socat (한컴독스 로그인시 필요해요)
- winetricks
- Python (.sh 파일만)
- 등등..

## 사용법

1. wine으로 윈도우용 한컴오피스를 공식 [설치프로그램](https://cdn.hancom.com/pds/hnc/DOWN/HancomDocs/HancomOffice_HancomDocs_ko.exe)을 통해 설치해주세요.
2. 릴리즈 탭에서 최신 패쳐를 다운로드 해주세요.
3. ```chmod +x ./hoffice-patcher.sh```
4. ```./hoffice-patcher.sh```
5. 패치가 완료되면 바로 한컴독스 로그인을 해주세요!
   
## 테스트된 환경

- wine-11.0 (Staging)
- winetricks 20260125
- Python 3.14.3

OS: Fedora Linux 43 (Workstation Edition) x86_64

Kernel: Linux 6.19.9-200.fc43.x86_64

WM: Hyprland 0.54.3 (Wayland)

IME(입력기): fcitx5/kime

## ..
<img width="1915" height="1078" alt="1776595426" src="https://github.com/user-attachments/assets/b0c677cc-7da0-4187-bbc3-9f7f7eecdbcc" />

<img width="1917" height="1077" alt="1776601986" src="https://github.com/user-attachments/assets/93f612b1-2b37-4ed6-b897-b0bff14bdb64" />


