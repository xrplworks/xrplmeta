import log from '@mwni/log'
import { spawn } from 'multitasked'
import { open as openDB } from '../db/index.js'
import { startCrawlers } from '../crawl/crawl.js'


export async function run({ ctx }){
	await spawn(':runCrawl', { ctx })
}


export async function runCrawl({ ctx }){
	if(ctx.log)
		log.pipe(ctx.log)

	log.info('starting crawlers')

	return await startCrawlers({
		ctx: {
			...ctx,
			db: openDB({ ctx })
		}
	})
}