const tap = require('tap')
const signatures = require('sodium-signatures')
const multibase = require('multibase')
const { create, post } = require('../../src/index')
const MemoryStore = require('../../src/stores/memory')

tap.test('post a message', async function(t) {
  const messageStore = new MemoryStore()
  const m = create('hi')
  const posted = await post(m, { messageStore })
  t.ok(posted)
  const mExists = await messageStore.exists(m.meta.hash)
  t.true(mExists)
})

tap.test('post a message, sign if there are keys provided', async function(t) {
  const keys = signatures.keyPair()
  const messageStore = new MemoryStore()
  const m = create('hi')
  const posted = await post(m, { messageStore, keys })
  t.ok(posted)
  t.ok(posted.meta)
  t.same(posted.meta.signed[0].type, 'route')
  t.same(typeof posted.meta.signed[0].publicKey, 'string')
  t.same(keys.publicKey, multibase.decode(posted.meta.signed[0].publicKey))
})
