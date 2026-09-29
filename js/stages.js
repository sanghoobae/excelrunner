// 스테이지 설정: 야근 탈출 주간
// chunks = 등장 패턴과 가중치, gap = 패턴 사이 평지 길이(px, 속도 배율 적용 전)
CR.STAGES = [
  {
    id: 'mon', name: '월요일', duration: 60, speed: 1.0, gap: [230, 380],
    chunks: { coins: 3, low: 4, doubleLow: 1.5, tall: 2 },
    line: "' 이번 주는 반드시 칼퇴한다.",
  },
  {
    id: 'tue', name: '화요일', duration: 70, speed: 1.15, gap: [210, 350],
    chunks: { coins: 3, low: 3, doubleLow: 1.5, tall: 2, pit: 3, pitWide: 1 },
    line: "' 화요일... 아직은 버틸 만하다.",
  },
  {
    id: 'wed', name: '수요일', duration: 80, speed: 1.3, gap: [200, 330],
    chunks: { coins: 2.5, low: 2, doubleLow: 1.5, tall: 1.5, pit: 2, pitWide: 1, air: 3, airLow: 1.5 },
    line: "' 수요일, 오류가 날아다니기 시작했다.",
  },
  {
    id: 'thu', name: '목요일', duration: 90, speed: 1.45, gap: [180, 310],
    chunks: { coins: 2.5, low: 1.5, doubleLow: 1.5, tall: 1.5, pit: 1.5, pitWide: 1, air: 2, airLow: 1, moving: 3, steps: 2 },
    line: "' 목요일. 참조가 전부 깨졌다.",
  },
  {
    id: 'fri', name: '금요일', duration: 100, speed: 1.6, gap: [160, 290],
    chunks: { coins: 2.5, low: 1, doubleLow: 1, tall: 1.5, pit: 1.5, pitWide: 1, air: 1.5, airLow: 1, moving: 2, steps: 1.5, rush: 3 },
    line: "' 금요일 결산. 살아서 퇴근하자.",
  },
  {
    id: 'endless', name: '무한야근', duration: Infinity, speed: 1.0, gap: [200, 340], endless: true,
    chunks: { coins: 2.5, low: 2, doubleLow: 1.5, tall: 1.5, pit: 2, pitWide: 1, air: 1.5, airLow: 1, moving: 1.5, steps: 1.5, rush: 1.5 },
    line: "' 퇴근은 없다. 오래 버틸수록 기록이 된다.",
  },
];
