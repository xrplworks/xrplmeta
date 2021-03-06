import { updateMarketcapByExchange, updateMarketcapBySupply } from './scopes/marketcaps.js'


export function createDerivatives({ ctx, newItems }){
	for(let exchange of newItems.tokenExchanges){
		updateMarketcapByExchange({ ctx, exchange })
	}

	for(let supply of newItems.tokenSupply){
		updateMarketcapBySupply({ ctx, supply })
	}
}

export function createAllDerivatives({ ctx }){
	let exchanges = ctx.db.tokenExchanges.iter()

	for(let exchange of exchanges){
		updateMarketcapByExchange({ ctx, exchange })
	}
}