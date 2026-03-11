# 🚀 NubScope — 로컬 실행 가이드

## 빠른 시작

### 1단계 — 의존성 설치 (처음 한 번만)

```powershell
cd "c:\Users\김예슬\Projects\NubScope(new1)_260311"
python -m pip install -r requirements.txt
```

### 2단계 — 서버 실행

```powershell
python app.py
```

### 3단계 — 브라우저에서 확인

| 페이지 | 주소 |
|---|---|
| 메인 화면 | http://localhost:5000 |
| 관리자 페이지 | http://localhost:5000/admin |

> 관리자 계정: `admin` / `tkfkd9@@`

---

## 문제 해결

### `python` 명령이 인식되지 않을 때
Microsoft Store Python 스텁 문제일 수 있습니다.

```powershell
# py 런처로 시도
py -m pip install -r requirements.txt
py app.py
```

또는 [https://python.org](https://python.org) 에서 Python 3.11+를 설치하세요.

### 포트 충돌 시
```powershell
# 다른 포트로 실행
set PORT=8080
python app.py
```
→ `http://localhost:8080` 으로 접속

---

## 주의사항

- `index.html`을 더블클릭해서 브라우저로 열면 **동작하지 않습니다**.
- 반드시 `python app.py`로 서버를 실행한 후 `localhost:5000`으로 접속하세요.
- DB 파일(`nubscope.db`)은 서버 최초 실행 시 자동 생성됩니다.

---

## Render 배포

Render 배포 방법은 [README.md](./README.md) 를 참고하세요.
