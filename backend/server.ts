import ccxt from "ccxt";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { v4 as uuidv4 } from "uuid";
import { WebSocket, WebSocketServer } from "ws";
import { Client, Exchange } from "./Client";
dotenv.config();

const exchanges = [
	new Exchange({
		clientName: "binance",
		client: new ccxt.binance({
			apiKey: process.env.BINANCE_API_KEY,
			secret: process.env.BINANCE_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "okx",
		client: new ccxt.okx({
			apiKey: process.env.OKX_API_KEY,
			secret: process.env.OKX_API_SECRET,
			password: process.env.OKX_API_PASSWORD,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "kucoin",
		client: new ccxt.kucoin({
			apiKey: process.env.KUCOIN_API_KEY,
			secret: process.env.KUCOIN_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "huobi",
		client: new ccxt.huobi({
			apiKey: process.env.HUOBI_API_KEY,
			secret: process.env.HUOBI_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "mexc",
		client: new ccxt.mexc({
			apiKey: process.env.MEXC_API_KEY,
			secret: process.env.MEXC_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "bybit",
		client: new ccxt.bybit({
			apiKey: process.env.BYBIT_API_KEY,
			secret: process.env.BYBIT_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "bitget",
		client: new ccxt.bitget({
			apiKey: process.env.BITGET_API_KEY,
			secret: process.env.BITGET_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "bitfinex",
		client: new ccxt.bitfinex2({
			apiKey: process.env.BITFINEX_API_KEY,
			secret: process.env.BITFINEX_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "btcturk",
		client: new ccxt.btcturk({
			apiKey: process.env.BTCTURK_API_KEY,
			secret: process.env.BTCTURK_API_SECRET,
		}),
		fee: 0.00075,
	}),
	new Exchange({
		clientName: "kraken",
		client: new ccxt.kraken({
			apiKey: process.env.KRAKEN_API_KEY,
			secret: process.env.KRAKEN_API_SECRET,
		}),
		fee: 0.00075,
	}),
];

const client = new Client({
	exchanges,
});

const app = express();
const port = 8000;

const clients: { [key: string]: any } = {};

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Function to send profits data to all connected clients
const sendMessageToClient = (clientId: string, message: any) => {
	const client = clients[clientId];
	if (client) {
		client.send(JSON.stringify(message));
	}
};

wss.on("connection", (ws: any) => {
	const clientId = uuidv4();
	console.log(`Received connection from client ${clientId}`);

	clients[clientId] = ws;
	console.log(`Successfully connected with client ${clientId}`);

	ws.on("message", async (message: any) => {
		console.log(`Received message => ${message}`);
		message = JSON.parse(message);

		if (message.type === "handshake") {
			sendMessageToClient(clientId, { type: "handshake", data: "Successfully connected" });
		} else if (message.type === "fetch-currencies") {
			await client.fetchCurrencies().then((currencies: any) => {
				sendMessageToClient(clientId, { type: "currencies", data: "Successfully fetched currencies" });
			});
		} else if (message.type === "fetch-tickers") {
			const startingCurrency = message.startingCurrency || "all";
			await client.fetchTickers(startingCurrency).then((tickers: any) => {
				sendMessageToClient(clientId, { type: "tickers", data: "Successfully fetched tickers" });
			});
		} else if (message.type === "search-arbitrage") {
			const startingExchange = message.startingExchange || "all";
			const endingExchange = message.endingExchange || "all";
			const startingCurrency = message.startingCurrency || "all";
			await client.checkArbitrage(startingExchange, endingExchange, startingCurrency).then((opportunities: any) => {
				sendMessageToClient(clientId, { type: "arbitrage", data: opportunities });
			});
		}
	});

	ws.on("close", () => {
		console.log("Client disconnected");
	});
});

// Start the server
server.listen(port, () => {
	console.log(`Server is listening at ${port}`);
});
