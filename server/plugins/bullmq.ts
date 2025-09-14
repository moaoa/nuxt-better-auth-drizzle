import { notionSyncWorker } from '~~/server/queues/notion-sync'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', async () => {
    await notionSyncWorker.close()
  })
})
