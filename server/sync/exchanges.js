import Decimal from 'decimal.js'
import log from '../../lib/log.js'


export function allocate(heads){
	log.time(`sync.candles`, `building exchanges cache`)

	let pairs = this.repo.exchanges.pairs(true)
	let count = this.repo.exchanges.count()
	let processed = 0
	let progress = 0


	for(let {base, quote} of pairs){
		let exchanges = [
			...this.repo.exchanges.iter({base: base, quote: quote}),
			...this.repo.exchanges.iter({base: quote, quote: base})
		]
		
		if(!base || !quote){
			//filter outliers, format exchange so volume is XRP
			exchanges = exchanges
				.filter(exchange => 
					formatExchange(
						exchange,
						base ? base : quote,
						base ? quote : base
					).volume.gte('0.001')
				)
		}

		exchanges.sort((a, b) => a.date - b.date)

		if(exchanges.length > 0){
			let exchangesBQ = exchanges.map(exchange => formatExchange(
				exchange, 
				base, 
				quote
			))

			let exchangesQB = exchanges.map(exchange => formatExchange(
				exchange, 
				quote, 
				base
			))

			this.cache.tx(() => {
				for(let timeframe of Object.values(this.config.server.marketTimeframes)){
					this.cache.candles.allocate(
						{base: base, quote: quote, timeframe},
						exchangesBQ
					)

					this.cache.candles.allocate(
						{base: quote, quote: base, timeframe},
						exchangesQB
					)
				}

				/*this.cache.trades.allocate(
					{base: base, quote: quote},
					exchangesBQ
				)

				this.cache.trades.allocate(
					{base: quote, quote: base},
					exchangesQB
				)*/
			})

			processed += exchanges.length
		}

		let newProgress = Math.floor((processed / count) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, processed, `of`, count, `exchanges (${progress}%)`)
		}
	}
	
	log.time(`sync.candles`, `built exchanges cache in %`)
}


export function register({ ranges }){
	if(!ranges.exchanges)
		return

	let newExchanges = this.repo.exchanges.iter({
		from: ranges.exchanges[0],
		to: ranges.exchanges[1]
	})

	for(let exchange of newExchanges){
		let exchangeBQ = formatExchange(exchange, exchange.base, exchange.quote)
		let exchangeQB = formatExchange(exchange, exchange.quote, exchange.base)

		if(!exchange.base || !exchange.quote){
			let volume = exchange.base ? exchangeBQ.volume : exchangeQB.volume

			if(volume.lt('0.01'))
				continue
		}

		for(let timeframe of Object.values(this.config.server.marketTimeframes)){
			this.cache.candles.integrate(
				{base: exchange.base, quote: exchange.quote, timeframe},
				exchangeBQ
			)

			this.cache.candles.integrate(
				{base: exchange.quote, quote: exchange.base, timeframe},
				exchangeQB
			)
		}

		/*this.cache.trades.integrate(
			{base: exchange.base, quote: exchange.quote},
			exchangeBQ
		)

		this.cache.trades.integrate(
			{base: exchange.quote, quote: exchange.base},
			exchangeQB
		)*/
	}
}

function formatExchange(exchange, base, quote){
	if(exchange.base === base){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: exchange.price,
			volume: Decimal.mul(exchange.volume, exchange.price)
		}
	}else if(exchange.base === quote){
		return {
			id: exchange.id,
			ledger: exchange.ledger,
			date: exchange.date,
			price: Decimal.div('1', exchange.price),
			volume: exchange.volume
		}
	}else{
		throw 'unexpected base/quote pair'
	}
}