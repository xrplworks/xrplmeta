import Decimal from 'decimal.js'
import { unixNow } from '@xrplworks/time'
import { keySort, mapMultiKey } from '../../lib/utils.js'
import log from '../../lib/log.js'




export function allocate(heads){
	log.time(`sync.tokens`, `building tokens cache`)

	let tokens = this.repo.tokens.all()
	let progress = 0
	
	for(let i=0; i<tokens.length; i++){
		compose.call(this, tokens[i])

		let newProgress = Math.floor((i / tokens.length) * 100)

		if(newProgress !== progress){
			progress = newProgress
			log.info(`processed`, i, `of`, tokens.length, `tokens (${progress}%)`)
		}
	}

	log.time(`sync.tokens`, `built tokens cache in %`)
}

export function register({ affected }){
	let relevant = affected.filter(({contexts}) => 
		contexts.some(context => ['exchange', 'meta', 'stats', 'self'].includes(context)))

	for(let { type, id } of relevant){
		if(type === 'token'){
			compose.call(this, this.repo.tokens.get({id}))
			log.debug(`updated token (TL${id})`)
		}else if(type === 'account'){
			for(let token of this.repo.tokens.all({issuer: id})){
				compose.call(this, token)
				log.debug(`updated token (TL${token.id})`)
			}
		}
	}
}

export function update(id){
	compose.call(this, this.repo.tokens.get({id}))
}

function compose(token){
	let { id, currency, issuer: issuerId } = token
	let issuer = this.repo.accounts.get({id: issuerId})	

	let currencyMetas = this.repo.tokenMetas.all({token})
	let issuerMetas = this.repo.tokenMetas.all({account: issuerId})

	if(issuer.domain)
		issuerMetas.push({
			key: 'domain', 
			value: issuer.domain, 
			source: 'ledger'
		})

	let meta = {
		currency: sortMetas(
			mapMultiKey(currencyMetas, 'key', true),
			this.config.server.sourcePriorities
		),
		issuer: sortMetas(
			mapMultiKey(issuerMetas, 'key', true),
			this.config.server.sourcePriorities
		)
	}

	let trusted = [meta.currency, meta.issuer].some(({ trusted, xumm_trusted }) => {
		if(trusted && trusted[0].value)
			return true

		if(xumm_trusted && xumm_trusted[0].value)
			return true
	})

	let currentStats = this.repo.tokenSnapshots.get(token)
	let yesterdayStats
	let stats = {
		marketcap: new Decimal(0),
		volume: {
			day: new Decimal(0),
			week: new Decimal(0),
		},
		trustlines: 0
	}

	let now = unixNow()
	let candles = this.cache.candles.all(
		{base: id, quote: null, timeframe: 3600},
		now - 60*60*24*7
	)


	if(currentStats){
		stats.supply = currentStats.supply
		stats.liquidity = {ask: currentStats.ask, bid: currentStats.bid}
		stats.trustlines = currentStats.trustlines

		let yesterday = this.repo.tokenSnapshots.get(token, currentStats.date - 60*60*24)
		let lastWeek = this.repo.tokenSnapshots.get(token, currentStats.date - 60*60*24*7)

		if(yesterday){
			stats.trustlines_change = {
				day: currentStats.trustlines - yesterday.trustlines,
				week: currentStats.trustlines - lastWeek.trustlines
			}
		}
	}

	if(candles.length > 0){
		let newestCandle = candles[candles.length - 1]
		let yesterdaysCandle = candles.find(candle => candle.t >= newestCandle.t - 60*60*24)
		let lastWeeksCandle = candles[0]

		stats.price = newestCandle.c
		stats.price_change = {
			day: (newestCandle.c / yesterdaysCandle.o - 1) * 100,
			week: (newestCandle.c / lastWeeksCandle.o - 1) * 100
		}

		stats.marketcap = Decimal.mul(stats.supply || 0, newestCandle.c)
		stats.volume = {
			day: Decimal.sum(
				...candles
					.slice(candles.indexOf(yesterdaysCandle))
					.map(candle => candle.v)
			),
			week: Decimal.sum(
				...candles
					.map(candle => candle.v)
			)
		}
	}

	let composed = {
		id,
		currency, 
		issuer: issuer.address,
		meta,
		stats,
		trusted
	}

	this.cache.tokens.insert({
		...composed,
		popular: calculatePopularityScore(composed)
	})
}

function calculatePopularityScore(token){
	let score = 0

	if(token.tokenSnapshots.volume)
		score += parseFloat(token.tokenSnapshots.volume.day)

	if(token.tokenSnapshots.trustlines)
		score += token.tokenSnapshots.trustlines * 5

	if(token.tokenSnapshots.trustlines_change)
		score += token.tokenSnapshots.trustlines_change.day * 5

	if(token.trusted)
		score *= 1.5

	return score
}


function sortMetas(metas, priorities){
	let sorted = {}

	for(let [key, values] of Object.entries(metas)){
		if(Array.isArray(values)){
			sorted[key] = keySort(values, meta => {
				let index = priorities.indexOf(meta.source)

				return index >= 0 ? index : 9999
			})
		}else if(typeof values === 'object'){
			sorted[key] = sortMetas(values, priorities)
		}
	}

	return sorted
}


function collapseMetas(metas, sourcePriority){
	let collapsed = {}

	for(let [key, values] of Object.entries(metas)){
		if(!values)
			continue

		if(Array.isArray(values)){
			let meta = values[0]

			if(meta.value)
				collapsed[key] = meta.value
		}else{
			collapsed[key] = collapseMetas(values, sourcePriority)
		}
	}

	return collapsed
}