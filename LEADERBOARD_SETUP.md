# 리더보드 설정 가이드

## 1. Google Sheets 생성

1. [Google Sheets](https://sheets.google.com)에 접속
2. 새 스프레드시트 생성
3. 이름을 "Vertical Platformer Leaderboard"로 지정
4. 첫 번째 시트의 이름을 "Leaderboard"로 변경
5. A1~C1 셀에 다음 헤더 입력:
   - A1: `Score`
   - B1: `Initial`
   - C1: `Date`

## 2. Google Apps Script 설정

1. Google Sheets에서 **확장 프로그램 > Apps Script** 클릭
2. 기본 코드를 모두 삭제
3. 아래의 `Code.gs` 내용을 복사해서 붙여넣기
4. 💾 **저장** 버튼 클릭 (Ctrl+S 또는 Cmd+S)
5. **배포 > 새 배포** 클릭
6. **유형 선택 > 웹 앱** 선택
7. 설정:
   - **설명**: Leaderboard API
   - **실행 계정**: 나
   - **액세스 권한**: 모든 사용자
8. **배포** 클릭
9. ⚠️ **권한 승인 과정** (처음 배포 시):
   - "권한 검토" 화면이 나타나면 **권한 검토** 클릭
   - 본인의 Google 계정 선택
   - "Google에서 이 앱을 확인하지 않았습니다" 경고가 나타남
   - **고급** 또는 **Advanced** 클릭
   - **[프로젝트 이름]로 이동(안전하지 않음)** 클릭
   - **허용** 버튼 클릭
10. **웹 앱 URL**을 복사 (예: https://script.google.com/macros/s/...../exec)
11. 복사한 URL을 `config.js` 파일의 `API_URL`에 붙여넣기

## 3. Code.gs 내용

```javascript
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'getTop10') {
    return getTop10();
  }

  return ContentService.createTextOutput(JSON.stringify({error: 'Invalid action'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const action = e.parameter.action;

  if (action === 'addScore') {
    const score = parseInt(e.parameter.score);
    const initial = e.parameter.initial || 'AAA';
    return addScore(score, initial);
  }

  return ContentService.createTextOutput(JSON.stringify({error: 'Invalid action'}))
    .setMimeType(ContentService.MimeType.JSON);
}

function getTop10() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leaderboard');
  const data = sheet.getDataRange().getValues();

  // Skip header row and sort by score (descending)
  const scores = data.slice(1)
    .filter(row => row[0]) // Filter out empty rows
    .map(row => ({
      score: row[0],
      initial: row[1],
      date: row[2]
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10); // Get top 10

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    scores: scores
  })).setMimeType(ContentService.MimeType.JSON);
}

function addScore(score, initial) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Leaderboard');
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  // Add new score
  sheet.appendRow([score, initial.toUpperCase().substring(0, 4), date]);

  // Get all data and sort by score
  const data = sheet.getDataRange().getValues();
  const header = data[0];
  const scores = data.slice(1)
    .filter(row => row[0])
    .sort((a, b) => b[0] - a[0]);

  // Keep only top 100 to prevent unlimited growth
  const top100 = scores.slice(0, 100);

  // Clear sheet and rewrite
  sheet.clear();
  sheet.appendRow(header);
  top100.forEach(row => sheet.appendRow(row));

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Score added successfully'
  })).setMimeType(ContentService.MimeType.JSON);
}
```

## 4. 게임에서 사용하기

1. `config.js` 파일을 열어서 복사한 웹 앱 URL을 붙여넣기
2. 게임을 열면 자동으로 리더보드가 로드됩니다
3. Top 10 기록을 경신하면 이니셜 입력 창이 뜹니다

## 주의사항

- Apps Script 배포 후 변경사항이 있으면 **새 배포**를 만들어야 합니다
- 또는 기존 배포를 **관리 > 수정**하여 버전을 업데이트할 수 있습니다

## 🔒 "Google에서 이 앱을 확인하지 않았습니다" 경고 해결 방법

이 경고는 정상입니다! 본인이 만든 스크립트이므로 안전합니다.

**해결 단계:**
1. "Google에서 이 앱을 확인하지 않았습니다" 화면에서
2. 왼쪽 하단의 **"고급"** 또는 **"Advanced"** 텍스트 클릭
3. **"[프로젝트 이름]로 이동(안전하지 않음)"** 링크 클릭
4. **"허용"** 버튼 클릭

이렇게 하면 본인의 앱이므로 승인 없이 사용할 수 있습니다.

**왜 이런 경고가 뜨나요?**
- Google Apps Script는 공개 배포 시 Google의 검증 프로세스를 거쳐야 합니다
- 하지만 본인만 사용하거나 소규모로 사용하는 앱은 검증 없이 사용 가능합니다
- "고급" 버튼을 통해 본인 책임 하에 사용할 수 있습니다
