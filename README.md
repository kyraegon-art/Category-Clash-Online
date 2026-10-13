# Category Clash — Online multiplayer

Two-player real-time category race using Node.js, Express, and Socket.IO. Players join from separate devices using a room code or an invitation link. The server checks valid answers, keeps each player's score, and declares the winner at 10 correct unique answers. The host starts each new round with a new category.

## Run locally

1. Install Node.js 18 or later.
2. In this folder run `npm install` and `npm start`.
3. Open `http://localhost:3000` in your browser.

## Put it online (Render example)

1. Upload this entire project to a new **GitHub** repository.
2. On https://render.com, create a **New > Web Service** connected to that repository.
3. Set **Build command** to `npm install`, **Start command** to `npm start` and select **Node** runtime.
4. Deploy and open the public HTTPS URL. Your friend opens the same URL and uses your invite link or room code.

A Render free instance may spin down when idle, causing a slow first load. Use **one server instance**, because rooms are stored in that process's memory. Rooms and scores reset on server restart. For production scaling/persistent rooms, add a Redis adapter and persistent database.

## Fair-play rules

- The server — not the browser — validates answers and declares the winner.
- Only the room creator can start new rounds.
- An answer can be used once per player per round; both players may independently submit the same item.
- Answer acceptance uses a curated list, so some reasonable answers may not be included; expand `categories.js` as desired.
- Each room supports exactly two players; refresh/reconnect uses a locally saved session token.
