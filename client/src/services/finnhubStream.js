export const connectFinnhubStream = (token, pairs, onMessage) => {
  const ws = new WebSocket(`wss://ws.finnhub.io?token=${token}`);
  ws.onopen = () => {
    pairs.forEach(pair => {
      const symbol = 'OANDA:' + pair.replace('/', '_');
      ws.send(JSON.stringify({ type: 'subscribe', symbol }));
    });
  };
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'trade' && msg.data) {
      msg.data.forEach(trade => {
        const symbol = trade.s;
        const pair = symbol.replace('OANDA:', '').replace('_', '/');
        onMessage(pair, trade.p, trade.v);
      });
    }
  };
  return ws;
};