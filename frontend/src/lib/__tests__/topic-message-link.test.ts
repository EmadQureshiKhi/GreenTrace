import { describe, expect, it } from 'vitest';
import { hashscanTopicMessageTarget, hashscanTopicMessageUrl, parseTopicMessage } from '../chain-config';

describe('topic message links', () => {
  it('go through the app route, since HashScan has no page per sequence number', () => {
    expect(hashscanTopicMessageUrl('0.0.11116480', 61)).toBe('/hcs/0.0.11116480/61');
  });

  it('accept only an entity id and a positive sequence number', () => {
    expect(parseTopicMessage('0.0.11116480', '61')).toEqual({ topicId: '0.0.11116480', sequence: 61 });
    expect(parseTopicMessage('0.0.11116480', '0')).toBeNull();
    expect(parseTopicMessage('0.0.11116480', '6a')).toBeNull();
    expect(parseTopicMessage('topic', '61')).toBeNull();
  });

  it('land on the submit transaction by consensus timestamp, or the topic when it is not known yet', () => {
    expect(hashscanTopicMessageTarget('0.0.11116480', '1792629258.578600610')).toBe('https://hashscan.io/testnet/transaction/1792629258.578600610');
    expect(hashscanTopicMessageTarget('0.0.11116480', null)).toBe('https://hashscan.io/testnet/topic/0.0.11116480');
    expect(hashscanTopicMessageTarget('0.0.11116480', '../x')).toBe('https://hashscan.io/testnet/topic/0.0.11116480');
  });
});
