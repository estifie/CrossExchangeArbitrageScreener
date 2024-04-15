import ccxt, { Exchange as CCXTExchange, Currency, OrderBook, Ticker } from "ccxt";
import { chainNameNormalizer } from "./utils";

interface ExchangeParams {
	clientName: string;
	client: CCXTExchange;
	fee: number;
}

interface ClientParams {
	exchanges: Exchange[];
	blacklistedCurrencies?: string[];
	blacklistedChains?: string[];
	minimumProfit?: number;
	maximumProfit?: number;
}

interface ChainData {
	chainName: string;
	deposit: boolean;
	withdraw: boolean;
	withdrawFee: number;
}

interface TickerData {
	bid: number;
	bidVolume: number;
	ask: number;
	askVolume: number;
}

export class Client {
	private exchanges: Exchange[];
	private chainData: { [key: string]: { [key: string]: ChainData[] } } = {};
	private exchangeTickers: { [key: string]: { [key: string]: TickerData } } = {};
	private blacklistedCurrencies: string[] = [];
	private blacklistedChains: string[] = [];
	private minimumProfit: number = 0.005;
	private maximumProfit: number = 0.05;

	constructor({ exchanges, blacklistedCurrencies, blacklistedChains, minimumProfit, maximumProfit }: ClientParams) {
		this.exchanges = exchanges;
		this.blacklistedCurrencies = blacklistedCurrencies || [];
		this.blacklistedChains = blacklistedChains || [];
		this.minimumProfit = minimumProfit || 0.005;
		this.maximumProfit = maximumProfit || 0.02;
	}

	/**
	 * Fetches the currencies and their corresponding chain data for all the exchanges.
	 * @returns A promise that resolves to an object containing the currencies and their chain data.
	 */
	async fetchCurrencies(): Promise<{ [key: string]: { [key: string]: ChainData[] } }> {
		const promises = this.exchanges.map(async (exchange) => {
			console.log(`Fetching currencies for ${exchange.clientName}...`);
			const currencies = await exchange.fetchCurrencies();

			for (const currency in currencies) {
				if (!this.chainData[currency]) {
					this.chainData[currency] = {};
				}

				this.chainData[currency][exchange.clientName] = currencies[currency];
			}
		});

		await Promise.all(promises);

		return this.chainData;
	}

	/**
	 * Fetches the tickers for all the exchanges.
	 * @returns A promise that resolves to an object containing the tickers.
	 */
	async fetchTickers(): Promise<{ [key: string]: { [key: string]: TickerData } }> {
		const promises = this.exchanges.map(async (exchange) => {
			console.log(`Fetching tickers for ${exchange.clientName}...`);
			const tickers = await exchange.fetchTickers();
			for (const symbol in tickers) {
				if (!this.exchangeTickers[symbol]) {
					this.exchangeTickers[symbol] = {};
				}
				this.exchangeTickers[symbol][exchange.clientName] = tickers[symbol];
			}
		});
		await Promise.all(promises);
		return this.exchangeTickers;
	}

	async checkArbitrage(startingExchange: string, endingExchange: string): Promise<any> {
		/**
		 *
		 * 	1. Check for blacklisted currencies
		 * 	2. For each ticker in exchangeTickers, check if there is an arbitrage opportunity in the prices
		 * 	3. If there is an arbitrage opportunity, calculate the profit and print the details
		 *
		 */

		await this.fetchTickers();

		// If there are no tickers, return
		if (Object.keys(this.exchangeTickers).length === 0) {
			return;
		}

		const arbitrageOpportunities: any[] = [];

		for (const symbol in this.exchangeTickers) {
			const tickers = this.exchangeTickers[symbol];
			const currencies = symbol.split("/");
			const [baseCurrency, quoteCurrency] = currencies;

			if (this.blacklistedCurrencies.includes(baseCurrency) || this.blacklistedCurrencies.includes(quoteCurrency)) {
				continue;
			}

			const baseCurrencyTickers = Object.entries(tickers).filter(([exchange, ticker]) => {
				return ticker.askVolume > 0;
			});

			const quoteCurrencyTickers = Object.entries(tickers).filter(([exchange, ticker]) => {
				return ticker.bidVolume > 0;
			});

			for (const [baseExchange, baseTicker] of baseCurrencyTickers) {
				for (const [quoteExchange, quoteTicker] of quoteCurrencyTickers) {
					if (baseExchange === quoteExchange) {
						continue;
					}

					if (startingExchange !== "all" && startingExchange.toLowerCase() !== baseExchange.toLowerCase()) {
						continue;
					}

					if (endingExchange !== "all" && endingExchange.toLowerCase() !== quoteExchange.toLowerCase()) {
						continue;
					}

					// Check chains
					const baseChainData = this.chainData[baseCurrency][baseExchange];
					const quoteChainData = this.chainData[quoteCurrency][quoteExchange];

					const baseExchangeObj = this.exchanges.find((exchange) => exchange.clientName === baseExchange);
					const quoteExchangeObj = this.exchanges.find((exchange) => exchange.clientName === quoteExchange);

					const baseExchangeFee = baseExchangeObj?.fee!;
					const quoteExchangeFee = quoteExchangeObj?.fee!;

					// If baseChainData or quoteChainData is undefined, continue
					if (!baseChainData || !quoteChainData) {
						continue;
					}

					const validChainNames = baseChainData
						.filter((baseChain) => {
							return (
								baseChain.deposit &&
								quoteChainData.some((quoteChain) => {
									return (
										quoteChain.withdraw &&
										baseChain.chainName === quoteChain.chainName &&
										baseChain.chainName !== "ERC20"
									);
								})
							);
						})
						.map((baseChain) => baseChain.chainName);

					if (!validChainNames || validChainNames.length === 0) {
						continue;
					}

					const baseAskPrice = baseTicker.ask;
					const quoteBidPrice = quoteTicker.bid;

					if (baseAskPrice < quoteBidPrice) {
						const profitWithoutTradingFees = (quoteBidPrice - baseAskPrice) / baseAskPrice;

						const profitWithTradingFees =
							(quoteBidPrice * (1 - quoteExchangeFee) - baseAskPrice * (1 + baseExchangeFee)) / baseAskPrice;

						if (profitWithTradingFees < this.minimumProfit || profitWithTradingFees > this.maximumProfit) {
							continue;
						}

						// Calculate withdraw fee
						const baseChain = baseChainData.find((chain) => validChainNames.includes(chain.chainName));

						const withdrawFee = (baseChain?.withdrawFee! * baseAskPrice).toFixed(3);

						if (Number(withdrawFee) > 0.4) continue;

						// Retrieve the orderbook
						const baseOrderBook = (
							await baseExchangeObj?.fetchOrderBook(`${baseCurrency}/${quoteCurrency}`)
						)?.asks.slice(0, 5);
						const quoteOrderBook = (
							await quoteExchangeObj?.fetchOrderBook(`${baseCurrency}/${quoteCurrency}`)
						)?.bids.slice(0, 5);

						const buyOrderBookText = `${baseOrderBook?.[0]?.[0]!.toFixed(5)} - ${(
							baseOrderBook?.[0]?.[0]! * baseOrderBook?.[0]?.[1]!
						).toFixed(3)} USDT\n${baseOrderBook?.[1]?.[0]!.toFixed(5)} - ${(
							baseOrderBook?.[1]?.[0]! * baseOrderBook?.[1]?.[1]!
						).toFixed(3)} USDT`;

						const sellOrderBookText = `${quoteOrderBook?.[0]?.[0]!.toFixed(5)} - ${(
							quoteOrderBook?.[0]?.[0]! * quoteOrderBook?.[0]?.[1]!
						).toFixed(3)} UDST\n${quoteOrderBook?.[1]?.[0]!.toFixed(5)} - ${(
							quoteOrderBook?.[1]?.[0]! * quoteOrderBook?.[1]?.[1]!
						).toFixed(3)} USDT`;

						arbitrageOpportunities.push({
							pair: `${baseCurrency}/${quoteCurrency}`,
							startingExchange: baseExchange,
							endingExchange: quoteExchange,
							buyPrice: baseAskPrice,
							sellPrice: quoteBidPrice,
							estimatedProfit: profitWithTradingFees,
							withdrawFee,
							chain: baseChain?.chainName,
							buyOrderbook: buyOrderBookText,
							sellOrderbook: sellOrderBookText,
							// baseExchange,
							// quoteExchange,
							// baseAskPrice,
							// quoteBidPrice,
							// baseCurrency,
							// quoteCurrency,
							// profitWithTradingFees,
							// profitWithoutTradingFees,
							// validChainNames,
							// baseChain,
							// withdrawFee,
							// baseChainData,
							// quoteChainData,
							// baseOrderBook,
							// quoteOrderBook,
						});
					}
				}
			}
		}

		const sortedArbitrageOpportunities = arbitrageOpportunities.sort((a, b) => b.profit - a.profit);

		return sortedArbitrageOpportunities;
	}
}

export class Exchange {
	public clientName: string;
	private client: CCXTExchange;
	public fee: number;

	constructor({ client, clientName, fee }: ExchangeParams) {
		this.client = client;
		this.clientName = clientName;
		this.fee = fee;
	}

	/**
	 * Fetches the currencies and their corresponding chain data.
	 * @returns A promise that resolves to an object containing the currencies and their chain data.
	 */
	async fetchCurrencies(): Promise<{ [key: string]: ChainData[] }> {
		const currencies = await this.client.fetchCurrencies();
		const currencyChainData: { [key: string]: ChainData[] } = {};

		for (const currency in currencies) {
			const chains: ChainData[] = [];
			let currencyData = currencies[currency];
			const network = currencyData.networks;

			Object.entries(network).forEach(([chainName, chainData]) => {
				chains.push({
					chainName: chainNameNormalizer(chainName),
					deposit: chainData.deposit,
					withdraw: chainData.withdraw,
					withdrawFee: chainData.fee,
				});
			});

			currencyChainData[currency] = chains;
		}

		return currencyChainData;
	}

	/**
	 * Fetches the tickers for the exchange.
	 * @returns A promise that resolves to an object containing the tickers.
	 */
	async fetchTickers(): Promise<{ [key: string]: TickerData }> {
		const tickers = await this.client.fetchTickers();

		const promises = Object.entries(tickers)
			.filter(([symbol, _]) => symbol.includes("/USDT")) // Filter out tickers that are not USDT pairs
			.map(async ([symbol, ticker]) => {
				symbol = symbol.replace(/:USDT$/, "");

				const tickerData: TickerData = {
					bid: Number(ticker.bid),
					bidVolume: Number(ticker.bidVolume),
					ask: Number(ticker.ask),
					askVolume: Number(ticker.askVolume),
				};

				return [symbol, tickerData];
			});

		const tickerDataEntries = await Promise.all(promises);

		const tickerData: { [key: string]: TickerData } = Object.fromEntries(tickerDataEntries);

		return tickerData;
	}

	/**
	 *
	 * Fetches the orderbook for given pair
	 * @param symbol
	 * @returns A promise that resolves to an object containing the orderbook
	 */
	async fetchOrderBook(symbol: string): Promise<OrderBook> {
		const orderbook = await this.client.fetchOrderBook(symbol);
		return orderbook;
	}
}
