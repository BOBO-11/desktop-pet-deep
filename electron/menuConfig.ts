export type WorkMenuItem = {
  label: string;
  duration: number;
  reward: number;
};

export type FeedMenuItem = {
  label: string;
  hungerRestore: number;
  cost: number;
};

export const WORK_MENU_ITEMS: WorkMenuItem[] = [
  { label: '5分钟 (+12积分)', duration: 5 * 60 * 1000, reward: 12 },
  { label: '10分钟 (+22积分)', duration: 10 * 60 * 1000, reward: 22 },
  { label: '20分钟 (+40积分)', duration: 20 * 60 * 1000, reward: 40 },
  { label: '30分钟 (+55积分)', duration: 30 * 60 * 1000, reward: 55 },
  { label: '1小时 (+95积分)', duration: 60 * 60 * 1000, reward: 95 }
];

export const FEED_MENU_ITEMS: FeedMenuItem[] = [
  { label: '烤鱼 - 8积分', hungerRestore: 25, cost: 8 },
  { label: '蒙德土豆饼 - 15积分', hungerRestore: 45, cost: 15 },
  { label: '嘟嘟莲糕点 - 28积分', hungerRestore: 75, cost: 28 },
  { label: '渔人吐司 - 38积分', hungerRestore: 100, cost: 38 }
];
