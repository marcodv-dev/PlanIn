import './Button.css'

function Button({ text, img, variant = 'primary', size = 'md', wide, fullWidth, onClick, type = 'button', className = '' }) {
  const hasContent = text || img
  const cls = [
    'cyber-btn',
    variant,
    size,
    wide ? 'wide' : '',
    fullWidth ? 'full' : '',
    className
  ].filter(Boolean).join(' ')

  return (
    <button type={type} className={cls} onClick={onClick}>
      {hasContent && (
        <span className="btn-content">
          {img && <img src={img} alt="" />}
          {text && <span>{text}</span>}
        </span>
      )}
    </button>
  )
}

export default Button
