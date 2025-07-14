# Netlify 개발 가이드

이 문서는 Netlify에서 안정적으로 빌드 및 배포를 하기 위한 가이드입니다. 실제로 발생한 문제와 해결 경험도 함께 축적합니다.

---

## 1. Netlify 빌드 안정화 기본 가이드

### 1.1. Node/NPM 버전 고정
- 프로젝트 루트에 `.nvmrc` 또는 `engines` 필드를 `package.json`에 명시하여 Netlify의 Node 버전을 고정합니다.
- 예시:
  ```json
  // package.json
  "engines": {
    "node": ">=16.0.0 <19"
  }
  ```

### 1.2. 환경 변수 관리
- Netlify의 환경 변수 설정을 사용하여 로컬과 동일한 환경을 맞춥니다.
- 예: REACT_APP_API_URL 등

### 1.3. 빌드 명령어 통일
- `package.json`의 `build` 스크립트가 Netlify와 로컬에서 동일하게 동작하도록 유지합니다.
- 예시:
  ```json
  "scripts": {
    "build": "react-scripts build"
  }
  ```

### 1.4. ESLint/TypeScript 오류 방지
- 빌드 시 lint 에러로 인한 실패를 방지하려면, 반드시 로컬에서 `npm run build`로 사전 점검합니다.
- 불필요한 미사용 변수, 정의되지 않은 변수 등은 즉시 수정합니다.

### 1.5. 의존성 관리
- `package-lock.json`을 항상 최신 상태로 유지합니다.
- Netlify 빌드 실패 시, `node_modules` 캐시를 초기화하거나 lock 파일을 재생성합니다.

### 1.6. 이미지/정적 파일 경로
- `public/` 또는 `src/assets/` 등 정적 파일 경로가 올바른지 확인합니다.
- 경로 대소문자 오류는 로컬에서는 통과해도 Netlify(리눅스 환경)에서는 실패할 수 있습니다.

---

## 2. Netlify 빌드/배포 트러블슈팅 경험 축적

### 2.1. ESLint: 'totalCalculatedSalary' is not defined
- **현상:** 빌드 실패, 콘솔에 'is not defined' 에러 출력
- **조치:**
  - 해당 변수가 실제로 선언/정의되어 있는지 확인
  - 필요하다면 변수 선언 추가 또는 불필요한 참조 제거
  - 미사용 변수는 삭제
- **경험:**
  - 선언되지 않은 변수를 참조하면 Netlify 빌드가 실패하므로, 반드시 사전 점검 필요
  - **실제 사례:**
    - `let totalCalculatedSalary = ...`가 if 블록 내부에 선언되어 블록 외부에서 참조 시 undefined 에러 발생
    - **해결:** 변수 선언을 if문 바깥(상위 스코프)으로 이동하여 전체 함수에서 접근 가능하도록 수정

### 2.2. 기타 경험은 아래에 계속 추가
- ...

---

## 3. 참고 링크
- [Netlify 공식 문서](https://docs.netlify.com/)
- [React 공식 빌드 가이드](https://create-react-app.dev/docs/deployment/) 