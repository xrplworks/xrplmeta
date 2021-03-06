import log from '@mwni/log'
import { scheduleGlobal } from '../common/schedule.js'
import { createFetch } from '../../lib/fetch.js'
import { writeAccountProps } from '../../db/helpers/props.js'


export default async function({ ctx }){
	let config = ctx.config.crawl?.xrpscan

	if(!config){
		throw new Error(`disabled by config`)
	}
	
	let fetch = createFetch({
		baseUrl: 'https://api.xrpscan.com/api/v1'
	})

	while(true){
		await scheduleGlobal({
			ctx,
			task: 'xrpscan.well-known',
			interval: config.crawlInterval,
			routine: async () => {
				log.info(`fetching well-known list...`)

				let { data } = await fetch('names/well-known')

				log.info(`got`, data.length, `well known`)

				for(let { account, name, domain, twitter } of data){
					let weblinks = undefined

					if(twitter){
						weblinks = [{
							url: `https://twitter.com/${twitter}`,
							type: `socialmedia`
						}]
					}

					writeAccountProps({
						ctx,
						account: {
							address: account
						},
						props: {
							name,
							domain,
							weblinks
						},
						source: 'xrpscan'
					})
				}

				log.info(`updated`, data.length, `issuers`)
			}
		})
	}
}