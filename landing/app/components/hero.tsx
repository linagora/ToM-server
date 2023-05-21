import logo from '../../public/logo.svg'

const Hero: React.FC = () => {
  return (
    <div className="h-auto flex flex-col items-center justify-center text-center space-y-12 pt-40 pb-32">
      <img src={logo} className="h-24 w-24 invert" alt="Twake on matrix Logo" />
      <h1 className="sm:text-4xl xl:text-4xl font-bold text-white max-w-4xl xl:max-w-5xl">
        An open network for secure, decentralized communication
      </h1>
      <a
        type="button"
        className="py-4 px-8 bg-gray-200 hover:bg-cyan-500 hover:text-zinc-200 rounded-full text-xl"
        href="https://to.twake.app/"
        target="_blank"
        rel="noreferrer noopener"
      >
        Invite to matrix
      </a>
    </div>
  )
}

export default Hero
