declare namespace NodeJS {
  interface ProcessEnv extends NodeJS.ProcessEnv {
    readonly DB_NAME: string
    readonly DB_USERNAME: string
    readonly DB_PASSWORD: string
    readonly DB_HOST: string
    readonly RABBIT_MQ_PROTOCOL: string
    readonly RABBIT_MQ_PORT: number
    readonly RABBIT_MQ_HOST: string
    readonly RABBIT_MQ_USERNAME: string
    readonly RABBIT_MQ_PASSWORD: string
  }
}
