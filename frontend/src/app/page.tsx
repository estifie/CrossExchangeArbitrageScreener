"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableFooter,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

interface Opportunity {
	pair: string;
	startingExchange: string;
	endingExchange: string;
	buyPrice: number;
	sellPrice: number;
	estimatedProfit: number;
	withdrawFee: number;
	chain: string;
	buyOrderbook: string;
	sellOrderbook: string;
}

const exchanges = ["Binance", "MEXC", "OKX", "Bitget", "Bybit", "Huobi", "Kucoin"];

export default function Home() {
	const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
	const [startingCurrency, setStartingCurrency] = useState("");
	const [positionSize, setPositionSize] = useState<number>();
	const [rowCount, setRowCount] = useState<number>();
	const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
	const [status, setStatus] = useState<string>("passive");
	const [fetchCurrenciesStatus, setFetchCurrenciesStatus] = useState<string>("passive");
	const [searchArbitrageStatus, setSearchArbitrageStatus] = useState<string>("passive");
	const [startingExchange, setStartingExchange] = useState<string>("");
	const [endingExchange, setEndingExchange] = useState<string>("");
	const [balances, setBalances] = useState<{ [key: string]: number }>({});

	const setupWebSocket = async () => {
		const ws = new WebSocket("ws://localhost:8000"); // WebSocket server address

		ws.onopen = () => {
			console.log("Connected to WebSocket server");
			setStatus("loading");
			ws.send(
				JSON.stringify({
					type: "handshake",
				}),
			); // Send starting currency to WebSocket server
		};
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);

			setStatus("active");

			if (data.type === "handshake") {
				setStatus("active");
				toast("Success!", {
					description: "Successfully connected to WebSocket server!",
				});
			} else if (data.type === "currencies") {
				toast("Success!", {
					description: "Successfully fetched currencies!",
				});
				setFetchCurrenciesStatus("passive");
			} else if (data.type === "arbitrage") {
				toast("Success!", {
					description: "Successfully fetched arbitrage opportunities!",
				});

				setOpportunities(data.data);
				setSearchArbitrageStatus("passive");
			}
		};

		ws.onclose = () => {
			console.log("WebSocket connection closed");
			setStatus("passive");
			setSearchArbitrageStatus("passive");
			setFetchCurrenciesStatus("passive");
			toast("Error!", {
				description: "WebSocket connection closed!",
			});
		};

		return ws;
	};

	const handleSetupWebSocket = async () => {
		if (wsInstance) {
			wsInstance.close();
			console.log("WebSocket connection closed");
		}

		const ws = await setupWebSocket();
		setWsInstance(ws);
	};

	const fetchCurrencies = async () => {
		setFetchCurrenciesStatus("loading");
		wsInstance?.send(
			JSON.stringify({
				type: "fetch-currencies",
			}),
		);
	};

	const searchArbitrage = async () => {
		setSearchArbitrageStatus("loading");
		wsInstance?.send(
			JSON.stringify({
				type: "search-arbitrage",
				startingExchange,
				endingExchange,
				startingCurrency,
			}),
		);
	};

	return (
		<div>
			<div className="flex items-center space-x-4 ml-6 mt-10">
				<StartingCurrency startingCurrency={startingCurrency} setStartingCurrency={setStartingCurrency} />
				<PositionSize positionSize={positionSize} setPositionSize={setPositionSize} />
				<StartingExchange setStartingExchange={setStartingExchange} />
				<EndingExchange setEndingExchange={setEndingExchange} />
				<Balances balances={balances} />
				<ControlPanel
					status={status}
					fetchCurrenciesStatus={fetchCurrenciesStatus}
					searchArbitrageStatus={searchArbitrageStatus}
					handleSetupWebSocket={handleSetupWebSocket}
					fetchCurrencies={fetchCurrencies}
					searchArbitrage={searchArbitrage}
				/>
			</div>
			<ArbitrageTable opportunities={opportunities} />
		</div>
	);
}

type ArbitrageTableProps = {
	opportunities: Opportunity[];
};

function ArbitrageTable({ opportunities }: ArbitrageTableProps) {
	return (
		<Table className="mt-10">
			<TableHeader>
				<TableRow>
					<TableHead className="w-[200px]">Pair</TableHead>
					<TableHead className="w-[200px]">Starting Exchange</TableHead>
					<TableHead className="w-[200px]">Ending Exchange</TableHead>
					<TableHead className="w-[200px]">Buy Price</TableHead>
					<TableHead className="w-[200px]">Sell Price</TableHead>
					<TableHead className="w-[200px]">Withdraw Fee</TableHead>
					<TableHead className="w-[200px]">Chain</TableHead>
					<TableHead className="w-[200px]">Buy Orderbook</TableHead>
					<TableHead className="w-[200px]">Sell Orderbook</TableHead>
					<TableHead className="w-[200px]">Estimated Profit</TableHead>
					<TableHead className="w-[200px]">Execute</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{opportunities &&
					opportunities.map((opportunity, index) => (
						<TableRow key={index}>
							<TableCell>{opportunity.pair}</TableCell>
							<TableCell>{opportunity.startingExchange}</TableCell>
							<TableCell>{opportunity.endingExchange}</TableCell>
							<TableCell>{opportunity.buyPrice}</TableCell>
							<TableCell>{opportunity.sellPrice}</TableCell>
							<TableCell>{opportunity.withdrawFee} USDT</TableCell>
							<TableCell>{opportunity.chain}</TableCell>
							<TableCell>{opportunity.buyOrderbook}</TableCell>
							<TableCell>{opportunity.sellOrderbook}</TableCell>
							<TableCell>{(opportunity.estimatedProfit * 100).toFixed(3)} %</TableCell>
							<TableCell>
								<Button>Execute</Button>
							</TableCell>
						</TableRow>
					))}
			</TableBody>
		</Table>
	);
}

type StartingCurrencyProps = {
	startingCurrency: string;
	setStartingCurrency: React.Dispatch<React.SetStateAction<string>>;
};

function StartingCurrency({ startingCurrency, setStartingCurrency }: StartingCurrencyProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="currency">Starting Currency</Label>
			<div className="flex w-full max-w-sm items-center space-x-2">
				<Input
					type="currency"
					id="currency"
					placeholder="e.g. USDT"
					value={startingCurrency}
					onChange={(e) => setStartingCurrency(e.target.value)}
				/>
			</div>
		</div>
	);
}

type PositionSizeProps = {
	positionSize: number | undefined;
	setPositionSize: React.Dispatch<React.SetStateAction<number | undefined>>;
};

function PositionSize({ positionSize, setPositionSize }: PositionSizeProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="currency">Position Size in USDT</Label>
			<div className="flex w-full max-w-sm items-center space-x-2">
				<Input
					type="balance"
					id="balance"
					placeholder="e.g. 20"
					value={positionSize}
					onChange={(e) => setPositionSize(Number(e.target.value))}
				/>
			</div>
		</div>
	);
}

type StartingExchangeProps = {
	setStartingExchange: React.Dispatch<React.SetStateAction<string>>;
};

function StartingExchange({ setStartingExchange }: StartingExchangeProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="starting-exchange">Starting Exchange</Label>
			<Select onValueChange={(value) => setStartingExchange(value)}>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Select Exchange" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Exchanges</SelectLabel>
						<SelectItem value="all">All Exchanges</SelectItem>
						{exchanges.map((exchange, index) => (
							<SelectItem key={index} value={exchange}>
								{exchange}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}

type EndingExchangeProps = {
	setEndingExchange: React.Dispatch<React.SetStateAction<string>>;
};

function EndingExchange({ setEndingExchange }: EndingExchangeProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="ending-exchange">Ending Exchange</Label>
			<Select onValueChange={(value) => setEndingExchange(value)}>
				<SelectTrigger className="w-[180px]">
					<SelectValue placeholder="Select Exchange" />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectLabel>Exchanges</SelectLabel>
						<SelectItem value="all">All Exchanges</SelectItem>
						{exchanges.map((exchange, index) => (
							<SelectItem key={index} value={exchange}>
								{exchange}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</div>
	);
}

type ControlPanelProps = {
	status: string;
	fetchCurrenciesStatus: string;
	searchArbitrageStatus: string;
	handleSetupWebSocket: () => void;
	fetchCurrencies: () => void;
	searchArbitrage: () => void;
};

function ControlPanel({
	status,
	fetchCurrenciesStatus,
	searchArbitrageStatus,
	handleSetupWebSocket,
	fetchCurrencies,
	searchArbitrage,
}: ControlPanelProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="currency">Control Panel</Label>
			<div className="flex w-full max-w-sm items-center space-x-4">
				{status === "passive" ? (
					<Button onClick={handleSetupWebSocket}>Start Websocket</Button>
				) : status === "active" ? (
					<Button disabled>Active Connection</Button>
				) : (
					<Button disabled>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Please wait
					</Button>
				)}
				{fetchCurrenciesStatus === "passive" ? (
					<Button onClick={fetchCurrencies}>Fetch Currencies</Button>
				) : (
					<Button disabled>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Fetching Currencies
					</Button>
				)}

				{searchArbitrageStatus === "passive" ? (
					<Button onClick={searchArbitrage}>Search Arbitrage</Button>
				) : (
					<Button disabled>
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						Searching Arbitrage
					</Button>
				)}
			</div>
		</div>
	);
}

type BalancesProps = {
	balances: { [key: string]: number };
};

function Balances({ balances }: BalancesProps) {
	return (
		<div className="grid w-auto max-w-sm items-center gap-1.5">
			<Label htmlFor="ending-exchange">USDT Balances</Label>
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>
						<Button variant="outline">Hover For Balances</Button>
					</TooltipTrigger>
					<TooltipContent>
						{exchanges.map((exchange, index) => (
							<p key={index}>
								{exchange}: {balances[exchange] || 0} USDT
							</p>
						))}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		</div>
	);
}
