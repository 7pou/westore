function copy(value) {
  return JSON.parse(JSON.stringify(value))
}

function createPage() {
  return {
    data: {},
    calls: [],
    setData(payload) {
      this.calls.push(copy(payload))
      Object.keys(payload).forEach(key => {
        const segments = key.replace(/\[(\d+)\]/g, '.$1').split('.')
        const leaf = segments.pop()
        let target = this.data
        segments.forEach((segment, index) => {
          if (!Object.prototype.hasOwnProperty.call(target, segment)) {
            Object.defineProperty(target, segment, {
              value: /^\d+$/.test(segments[index + 1] || leaf) ? [] : {},
              enumerable: true,
              configurable: true,
              writable: true,
            })
          }
          target = target[segment]
        })
        Object.defineProperty(target, leaf, {
          value: copy(payload[key]),
          enumerable: true,
          configurable: true,
          writable: true,
        })
      })
    },
  }
}

module.exports = {createPage}
