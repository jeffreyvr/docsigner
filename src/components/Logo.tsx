interface LogoProps {
  className?: string
  title?: string
}

/** vanrossum.dev mark */
export function Logo({ className = '', title = 'vanrossum.dev' }: LogoProps) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      viewBox="0 0 530.7 500"
      aria-label={title}
      role="img"
    >
      <path
        d="M225.5,0l-113.3,398h371.4l-107.1-162.2c45.9,0,121.4-26.5,148-109.2C552,41.8,484.7,0,398,0h-172.4Z"
        fill="#70f69a"
      />
      <polygon
        points="418.4 142.9 198 142.9 122.4 398 244.9 398 418.4 142.9"
        fill="#65e583"
      />
      <polygon
        className="logo-shade"
        points="245.1 397.9 142.1 397.9 118.4 500 176.8 498.9 245.1 397.9"
      />
      <polygon
        className="logo-ink"
        points="0 81.6 387.8 81.6 118.4 500 0 81.6"
      />
    </svg>
  )
}
