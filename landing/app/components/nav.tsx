import logo from '../../public/logo.svg'
import gitlab from '../../public/gitlab.svg'

const Nav: React.FC = () => {
  return (
    <nav className="bg-gray-100 bg-clip-border shadow-sm shadow-slate-800 h-20 w-full flex justify-between items-center fixed">
      <div className="inline-flex">
        <a href="/" title="Twake on matrix">
          <div className="pl-4">
            <img src={logo} alt="Twake on matrix logo" className="w-14 h-14" />
          </div>
        </a>
      </div>
      <div className="flex-auto">
        <div className="flex justify-end md:items-center relative">
          <div className="flex md:mr-4 md:items-center items-end space-x-10">
            <a
              href="https://twake.app/"
              title="Twake"
              target="_blank"
              rel="noreferrer noopener"
            >
              Twake
            </a>
            <a
              href="https://linagora.com/"
              title="Linagora"
              target="_blank"
              rel="noreferrer noopener"
            >
              LINAGORA
            </a>
          </div>
        </div>
      </div>
      <div className="flex-initial">
        <div className="flex md:justify-end md:items-center">
          <div className="flex md:mr-4 md:items-center">
            <div className="block relative">
              <a
                type="button"
                className="py-2 md:px-3 px-1 rounded-full relative"
                target="_blank"
                href="https://ci.linagora.com/publicgroup/oss/twake/tom-server"
                rel="noreferrer noopener"
                title="GitLab public repository"
              >
                <img
                  src={gitlab}
                  className="w-14 h-14"
                  alt="GitLab public repository"
                />
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Nav
