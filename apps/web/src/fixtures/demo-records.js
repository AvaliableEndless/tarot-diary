import { dayAgo } from '../domain/dates.js';

export function createDemoRecords() {
  const examples = [
    [1, 6, '', 'pending'],
    [2, 18, '散步回来时看见楼下的桂花开了，突然觉得明天也会有好事。', 'yes'],
    [3, 9, '今天讨论方案时没有急着反驳，先问了对方的顾虑，聊得比想象中顺利。', 'yes'],
    [5, 10, '下课后一个人走了十分钟，才发现最近其实是想让自己慢一点。', 'yes'],
    [7, 20, '没有特别开心的事，也没有关系，今天平平常常。', 'none'],
    [8, 1, '终于打开空白文档写了标题。开头真的只需要一个很小的动作。', 'yes'],
    [10, 15, '吃午饭时把手机收起来了，今天的饭有被认真吃掉。', 'yes'],
  ];
  return examples.map(([offset, cardId, text, status]) => ({
    id: `demo-${offset}`,
    date: dayAgo(offset),
    cardId,
    text,
    status,
    demo: true,
    createdAt: `${dayAgo(offset)}T08:30:00`,
  }));
}
