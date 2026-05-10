import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

export default async function handler(req, res) {
  // 1. 슬랙의 신호가 POST인지 확인
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  // 2. 슬랙에 "확인 중"이라고 먼저 답장 (3초 제한 때문)
  res.status(200).json({ 
    response_type: "ephemeral", 
    text: "🔎 구글 시트에서 규정을 조회하고 있습니다..." 
  });

  // 슬랙이 보낸 데이터(검색어와 답변할 주소) 가져오기
  const { text: query, response_url } = req.body;

  try {
    // 3. 구글 서비스 계정 인증 설정
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // 4. 구글 시트 불러오기
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // 첫 번째 탭
    const rows = await sheet.getRows();

    // 5. 시트에서 사용자가 입력한 단어(query)가 포함된 행 찾기
    const match = rows.find(row => 
      row.get('제목').includes(query) || row.get('키워드').includes(query)
    );

    let finalMessage;
    if (match) {
      finalMessage = `📌 *${match.get('제목')}* 안내입니다.\n\n${match.get('요약내용')}\n\n🔗 <${match.get('노션URL')}|노션에서 원문 보기>`;
    } else {
      finalMessage = `❓ '${query}'에 대한 내용을 시트에서 찾을 수 없습니다. 정확한 키워드로 다시 검색해주세요.`;
    }

    // 6. 슬랙의 response_url로 최종 결과 보내기
    await fetch(response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        response_type: "in_channel", // 채널의 모든 사람이 볼 수 있게 답변
        text: finalMessage 
      })
    });

  } catch (error) {
    console.error('에러 발생:', error);
  }
}
