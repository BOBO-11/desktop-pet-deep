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
  { label: '5分钟 (+15积分)', duration: 5 * 60 * 1000, reward: 15 },
  { label: '10分钟 (+28积分)', duration: 10 * 60 * 1000, reward: 28 },
  { label: '20分钟 (+50积分)', duration: 20 * 60 * 1000, reward: 50 },
  { label: '30分钟 (+60积分)', duration: 30 * 60 * 1000, reward: 60 },
  { label: '1小时 (+100积分)', duration: 60 * 60 * 1000, reward: 100 }
];

export const FEED_MENU_ITEMS: FeedMenuItem[] = [
  { label: '烤鱼 - 15积分', hungerRestore: 30, cost: 15 },
  { label: '蒙德土豆饼 - 25积分', hungerRestore: 50, cost: 25 },
  { label: '嘟嘟莲糕点 - 40积分', hungerRestore: 80, cost: 40 },
  { label: '渔人吐司 - 60积分', hungerRestore: 100, cost: 60 }
];
