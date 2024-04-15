import { readFileSync } from "fs";

const chainNames = JSON.parse(readFileSync("chains.json").toString());

export const chainNameNormalizer = (chainName: string): string => {
	chainName = chainName.toUpperCase();

	for (const key in chainNames) {
		if (chainNames[key].includes(chainName)) {
			return key;
		}
	}

	return chainName;
};
