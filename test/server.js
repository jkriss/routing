const tap = require('tap')
const signatures = require('sodium-signatures')
const Client = require('../src/client/index')
const Server = require('../src/server/core')
const MemoryStore = require('../src/stores/memory')
const MemorySyncStore = require('../src/client/mem-sync-store')
const tcp = require('../src/server/tcp')
const createHttpServer = require('../src/server/http')
const createHttpClient = require('../src/client/http')
const createInProcessTransport = require('../src/server/in-process')
const { encode } = require('../src/util/encoding')
const fs = require('fs-extra')

const createClient = ({ keys } = {}) => {
  if (!keys) keys = signatures.keyPair()
  const messageStore = new MemoryStore({ publicKey: keys.publicKey })
  const syncStore = new MemorySyncStore()
  return new Client({ messageStore, keys, syncStore })
}

const createServer = (opts = {}) => {
  if (!opts.keys) opts.keys = signatures.keyPair()
  const client = createClient({ keys: opts.keys })
  return new Server(Object.assign({ client }, opts))
}

const createServerClientPair = () => {
  const keys = signatures.keyPair()
  const server = createServer({ trustedKeys: [keys.publicKey] })
  const client = createClient({ keys })
  return { server, client }
}

tap.test(`don't allow access by untrusted keys`, async function(t) {
  t.plan(1)
  const server = createServer()
  const client = createClient()
  const m = await client.signCommand({ command: 'list' })
  const req = server.handle(m)
  req.on('error', m => {
    t.equal(m.type, 'error')
  })
  await new Promise(resolve => req.on('end', resolve))
})

tap.test(`empty list`, async function(t) {
  const { server, client } = createServerClientPair()
  const m = await client.signCommand({ command: 'list' })
  const res = server.handle(m)
  await new Promise(resolve => res.on('end', resolve))
})

tap.test(`get server info`, async function(t) {
  const { server, client } = createServerClientPair()
  const m = await client.signCommand({ command: 'info' })
  const res = server.handle(m)
  res.on('data', d => {
    t.ok(d.publicKey)
  })
  await new Promise(resolve => res.on('end', resolve))
})

tap.test(`run server over tcp`, async function(t) {
  const { server, client } = createServerClientPair()
  const m = await client.signCommand({ command: 'info' })
  const socket = '/tmp/nvivn.sock'
  await fs.remove(socket)
  const tcpServer = tcp.createServerTransport({ server, listen: socket })
  await tcpServer.listen()
  try {
    // returns a promise, resolves when connected to the server
    const tcpClient = await tcp.createClientTransport({ path: socket })
    client.setTransport(tcpClient)
    t.ok(client.transport)
    const serverInfo = await client.info()
    t.ok(serverInfo)
    t.equal(serverInfo.publicKey, encode(server.getPublicKey()))
  } finally {
    client.close()
    tcpServer.close()
  }
})

tap.test(`run server over http`, async function(t) {
  const { server, client } = createServerClientPair()
  const m = await client.signCommand({ command: 'info' })
  const port = 9898
  const httpServer = createHttpServer({ server })
  await httpServer.listen(port)
  try {
    const httpClient = await createHttpClient({
      url: `http://localhost:${port}`,
    })
    client.setTransport(httpClient)
    t.ok(client.transport)
    const serverInfo = await client.info()
    t.ok(serverInfo)
    t.equal(serverInfo.publicKey, encode(server.getPublicKey()))
  } finally {
    client.close()
    httpServer.close()
  }
})

tap.test(`sync from a server`, async function(t) {
  const server = createServer()
  const client = server.client
  const otherClient = createClient()
  server.trustedKeys.push(otherClient.defaultOpts.keys.publicKey)
  for (let i = 0; i < 5; i++) {
    const posted = await client
      .create({ body: `hi ${i + 1}` })
      .then(client.sign)
      .then(client.post)
  }
  t.equal(client.defaultOpts.messageStore.messages.length, 5)
  const postedMessages = await client.list()
  t.equal(postedMessages.length, 5)
  const originalMessages = await otherClient.list()
  t.same(originalMessages, [])
  const transport = createInProcessTransport({ server })
  let syncResult = await otherClient.sync('test server', { transport })
  const newMessages = await otherClient.list()
  t.equal(newMessages.length, 5)
  t.equal(syncResult.count, 5)
  // now should only request newer messages
  syncResult = await otherClient.sync('test server', { transport })
  t.equal(syncResult.count, 0)
})
