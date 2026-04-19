#!/usr/bin/env node
/*
 * 한글 오피스 2024 - Wine 실행 패치 스크립트
 */

'use strict';

const fs = import('fs');
const path = import('path');
const { spawnSync, spawn } = import('child_process');

const WINE_PREFIX = process.env.WINEPREFIX || path.join(process.env.HOME || '', '.wine');
const HNC_BIN = path.join(
  WINE_PREFIX,
  'drive_c',
  'Program Files (x86)',
  'Hnc',
  'Office 2024',
  'HOffice130',
  'Bin'
);

async function run(command, args, options = {}) {
  const cmd = new Deno.Command(command, {
    args,
    stdout: options.silent ? "null" : "inherit",
    stderr: options.silent ? "null" : "inherit",
  });

  const status = await cmd.spawn().status;

  if (!status.success) {
    throw new Error(`명령 실패: ${command}`);
  }
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    return null;
  }
  if (result.status !== 0) {
    return null;
  }

  return (result.stdout || '').trim();
}

function commandExists(cmd) {
  return spawnSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' }).status === 0;
}

function installPackage(pkg) {
  console.log(`  [${pkg}] 설치 중...`);

  if (commandExists('apt-get')) {
    run('sudo', ['apt-get', 'install', '-y', pkg]);
  } else if (commandExists('dnf')) {
    run('sudo', ['dnf', 'install', '-y', pkg]);
  } else if (commandExists('pacman')) {
    run('sudo', ['pacman', '-S', '--noconfirm', pkg]);
  } else if (commandExists('zypper')) {
    run('sudo', ['zypper', 'install', '-y', pkg]);
  } else if (commandExists('emerge')) {
    run('sudo', ['emerge', pkg]);
  } else {
    throw new Error(`지원하는 패키지 매니저를 찾을 수 없습니다. ${pkg} 를 수동으로 설치하세요.`);
  }
}

function backupOnce(filePath) {
  const backupPath = `${filePath}.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    return true;
  }
  return false;
}

function writeAt(fd, offset, bytes) {
  fs.writeSync(fd, Buffer.from(bytes), 0, bytes.length, offset);
}

function patchEngineDll(engineDll) {
  console.log('[3/6] HncOfficeEngine.dll 패치 중...');

  if (!fs.existsSync(engineDll)) {
    console.log('  [경고] 파일 없음, 건너뜀');
    return;
  }

  if (backupOnce(engineDll)) {
    console.log('  백업 완료: HncOfficeEngine.dll.bak');
  } else {
    console.log('  백업 이미 존재, 덮어쓰지 않음');
  }

  const fd = fs.openSync(engineDll, 'r+');
  try {
    writeAt(fd, 0x319b4, new Array(10).fill(0x90));

    const patch = [
      0x55,
      0x8b, 0xec,
      0x8b, 0x45, 0x08,
      0x33, 0xd2,
      0x89, 0x10,
      0x89, 0x50, 0x04,
      0xc7, 0x40, 0x08,
      0x0f, 0x00, 0x00, 0x00,
      0x5d,
      0xc2, 0x04, 0x00,
    ];

    writeAt(fd, 0x322d0, patch);
  } finally {
    fs.closeSync(fd);
  }

  console.log('  HncOfficeEngine.dll 패치 완료');
}

function patchModuleDll(moduleDll) {
  console.log('[4/6] HncOfficeModule.dll 패치 중...');

  if (!fs.existsSync(moduleDll)) {
    console.log('  [경고] 파일 없음, 건너뜀');
    return;
  }

  if (backupOnce(moduleDll)) {
    console.log('  백업 완료: HncOfficeModule.dll.bak');
  } else {
    console.log('  백업 이미 존재, 덮어쓰지 않음');
  }

  const fd = fs.openSync(moduleDll, 'r+');
  try {
    writeAt(fd, 0x3342b, [...new Array(15).fill(0x90), 0xc3]);
    writeAt(fd, 0x333fe, [...new Array(15).fill(0x90), 0xc3]);

    const ilPatch = [
      0x14,
      0x2a,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00,
    ];
    writeAt(fd, 0x1659c, ilPatch);

    const codeSize = Buffer.alloc(4);
    codeSize.writeUInt32LE(2, 0);
    fs.writeSync(fd, codeSize, 0, 4, 0x16590 + 4);
  } finally {
    fs.closeSync(fd);
  }

  const verifyFd = fs.openSync(moduleDll, 'r');
  try {
    const b1 = Buffer.alloc(16);
    const b2 = Buffer.alloc(4);
    fs.readSync(verifyFd, b1, 0, 16, 0x333fe);
    fs.readSync(verifyFd, b2, 0, 4, 0x1659c);
    console.log(`  0x333fe 확인: ${b1.toString('hex')}`);
    console.log(`  0x1659c 확인: ${b2.toString('hex')}`);
  } finally {
    fs.closeSync(verifyFd);
  }

  console.log('  HncOfficeModule.dll 패치 완료');
}

function disableFile(filePath) {
  const bakPath = `${filePath}.bak`;
  const name = path.basename(filePath);

  if (fs.existsSync(filePath) && !fs.existsSync(bakPath)) {
    fs.renameSync(filePath, bakPath);
    console.log(`  비활성화: ${name}`);
  } else if (fs.existsSync(bakPath)) {
    console.log(`  이미 비활성화됨: ${name}`);
  } else {
    console.log(`  없음(건너뜀): ${name}`);
  }
}

function setupWineRegAndSocat() {
  console.log('[6/6] Wine 레지스트리 및 socat 설정...');

  run('wine', [
    'reg',
    'add',
    'HKEY_CLASSES_ROOT\\http\\shell\\open\\command',
    '/ve',
    '/t',
    'REG_SZ',
    '/d',
    'xdg-open "%1"',
    '/f',
  ], { silent: true });
  console.log('  http 핸들러 등록 완료');

  run('wine', [
    'reg',
    'add',
    'HKEY_CLASSES_ROOT\\https\\shell\\open\\command',
    '/ve',
    '/t',
    'REG_SZ',
    '/d',
    'xdg-open "%1"',
    '/f',
  ], { silent: true });
  console.log('  https 핸들러 등록 완료');

  const running = spawnSync('pgrep', ['-f', 'socat.*TCP-LISTEN:80'], { stdio: 'ignore' }).status === 0;
  if (!running) {
    spawnSync('sudo', ['sysctl', '-w', 'net.ipv4.ip_unprivileged_port_start=0'], { stdio: 'ignore' });

    const child = spawn('socat', ['TCP-LISTEN:80,fork,reuseaddr', 'TCP:127.0.0.1:10121'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    console.log(`  socat 포트포워딩 시작 (80 → 10121), PID: ${child.pid}`);
  } else {
    console.log('  socat 이미 실행 중');
  }
}

function main() {
  console.log('=== 한글 2024 Wine 패치 시작 ===');
  console.log(`WINE PREFIX: ${WINE_PREFIX}`);
  console.log('');

  if (!fs.existsSync(HNC_BIN) || !fs.statSync(HNC_BIN).isDirectory()) {
    console.error(`[오류] 한글 설치 경로를 찾을 수 없습니다: ${HNC_BIN}`);
    console.error('WINEPREFIX 환경변수를 설정하거나 설치 경로를 확인하세요.');
    process.exit(1);
  }

  console.log('[1/6] socat 확인...');
  if (!commandExists('socat')) {
    console.log('  socat 미설치, 설치합니다...');
    installPackage('socat');
  } else {
    const socatPath = runCapture('bash', ['-lc', 'which socat']) || '(경로 확인 실패)';
    console.log(`  socat 이미 설치됨: ${socatPath}`);
  }

  console.log('[2/6] xdg-open 래퍼 생성...');
  const wrapperPath = '/tmp/xdg-open.sh';
  fs.writeFileSync(wrapperPath, '#!/bin/bash\nxdg-open "$@"\n', { mode: 0o755 });
  fs.chmodSync(wrapperPath, 0o755);
  console.log(`  완료: ${wrapperPath}`);

  const ENGINE_DLL = path.join(HNC_BIN, 'HncOfficeEngine.dll');
  const MODULE_DLL = path.join(HNC_BIN, 'HncOfficeModule.dll');

  patchEngineDll(ENGINE_DLL);
  patchModuleDll(MODULE_DLL);

  console.log('[5/6] 보안관련 프로세스 비활성화...');
  //disableFile(path.join(HNC_BIN, 'HncPrivacyAppModule.dll'));
  //disableFile(path.join(HNC_BIN, 'HncPrivacy.exe'));
  disableFile(path.join(HNC_BIN, 'A3DT.exe'));
  disableFile(path.join(HNC_BIN, 'A3Dll32.dll'));

  setupWineRegAndSocat();

  console.log('');
  console.log('=== 패치 완료 ===');
  console.log('재시작 하지 마시고 한글을 실행해 로그인부터 해주세요');
  //console.log('한글 실행:');
  //console.log('  WINEPREFIX=~/.wine wine "C:/Program Files (x86)/Hnc/Office 2024/HOffice130/Bin/Hwp.exe"');
  //console.log('');
  //console.log('패치 되돌리기:');
  //console.log(`  cp "${ENGINE_DLL}.bak" "${ENGINE_DLL}"`);
  //console.log(`  cp "${MODULE_DLL}.bak" "${MODULE_DLL}"`);
}

try {
  main();
} catch (error) {
  console.error(`[오류] ${error.message}`);
  process.exit(1);
}
