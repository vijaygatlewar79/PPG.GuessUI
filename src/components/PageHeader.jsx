import { useEffect, useState } from 'react'

function CurrentDateTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(now)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(now)

  return (
    <div className="current-date-time" title="India Standard Time (Asia/Kolkata)">
      <span>{date}</span>
      <time dateTime={now.toISOString()}>{time} IST</time>
    </div>
  )
}

export default function PageHeader({ actions }) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">PPG Guess Data</p>
        <div className="header-title-row">
          <h1>Panel Pattern Explorer</h1>
          <CurrentDateTime />
        </div>
        <p>Search the selected game's available open or close sequence and inspect the numbers that followed it.</p>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  )
}
