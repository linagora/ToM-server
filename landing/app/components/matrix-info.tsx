const MatrixInfo: React.FC = () => {
  return (
    <div className="bg-zinc-200 h-auto w-full flex flex-col items-center justify-center py-28 px-10">
      <div className="flex flex-col sm:space-y-5 md:flex-row items-center justify-center space-x-1 md:space-x-10 xl:space-x-36 2xl:px-96 xl:px-48 lg:px-24 px-0">
        <div className="md:basis-1/3 basis-1 flex flex-col items-center justify-center italic text-lg space-y-3 pb-10">
          <h1 className="font-bold text-lg">Imagine a world...</h1>
          <span>
            ...where it is as simple to message or call anyone as it is to send
            them an email.
          </span>
          <span>
            ...where you can communicate without being forced to install the
            same app.
          </span>
          <span>...where you can choose who hosts your communication.</span>
          <span>
            ...where your conversations are secured by E2E encryption.
          </span>
          <span>
            ...where there's a simple standard HTTP API for sharing real-time
            data on the web.
          </span>
        </div>
        <div className="md:basis-1/2 basis-1 flex flex-col items-center justify-center text-center sm:space-y-7 text-xl font-sans xl:pl-20">
          <h1 className="text-3xl font-bold">This is Matrix.</h1>
          <p>
            Matrix is an open source project that publishes the{' '}
            <a
              href="https://matrix.org/docs/spec"
              target="_blank"
              rel="noreferrer noopener"
              className="text-sky-500"
            >
              Matrix open standard
            </a>{' '}
            for secure, decentralised, real-time communication, and its Apache
            licensed{' '}
            <a
              href="https://github.com/matrix-org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sky-500"
            >
              reference implementations.
            </a>
          </p>
          <p>
            Maintained by the non-profit Matrix.org Foundation, we aim to create
            an open platform which is as independent, vibrant and evolving as
            the Web itself... but for communication.
          </p>
          <p>
            As of June 2019, Matrix is out of beta, and the protocol is fully
            suitable for production usage.
          </p>
        </div>
      </div>
    </div>
  )
}

export default MatrixInfo
