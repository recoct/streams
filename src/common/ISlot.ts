namespace WHATWG.Streams {
  export
  interface ISlot {
    didInstall(host: any): void
    willUninstall(host: any): void
  }
}
