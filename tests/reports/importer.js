function importScript(url, deps) {
  const r = new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.addEventListener('load', () => {
      if (success(xhr)) {
        resolve(xhr.responseText)
      } else {
        reject(xhr.statusText)
      }
    })
    xhr.addEventListener('error', () => {
      reject('network error')
    })
    xhr.open('GET', url)
    xhr.send(null)
  })

  r.then(responseText => {
    const prefix = '//@ sourceURL=' + url + '\n'
    const content = injectDependencies(responseText, deps)
    const script = document.createElement('script')
    script.dataset.src = url
    script.text = prefix + content
    document.body.append(script)
  }).catch(e => {
    console.error(e)
  })

  return r
}

function importScripts(urls, deps) {
  return Promise.all(urls.map(url => importScript(url, deps)))
}

function HANDLED(r) {
  return (r.catch(NO_OP), r)
}

function NO_OP() {}

function success(xhr) {
  return 200 <= xhr.status && xhr.status < 300
}

function injectDependencies(body, deps) {
  deps = deps || []
  /*const deps = [
    {
      namespace: 'globalThis',
      entites: [
        'self',
      ]
    },
    {
      namespace: 'WHATWG.Streams',
      entites: [
        'UnderlyingSource',
        'ReadableStream',
        'ReadableStreamDefaultReader',
        'UnderlyingSink',
        'WritableStream',
        'WritableStreamDefaultWriter',
        'CountQueuingStrategy',
        'ByteLengthQueuingStrategy',
      ]
    }
  ]*/
  const formals = [].concat(...deps.map(p => p.entites)).join(',')
  const actuals = [].concat(...deps.map(p => p.entites.map(e => p.namespace + '.' + e))).join(',')
  const header = ';((' + formals + ')=>{'
  const footer = '})(' + actuals + ');'
  return header + body + footer
}
