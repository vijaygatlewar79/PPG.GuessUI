export const patternOptions = [
  { value: 'All', label: 'All Pattern' },
  {
    value: 'AIG',
    label: 'AIG Pattern',
    kind: 'prediction',
    endpoint: '/api/pattern-prediction',
  },
  {
    value: 'AIGDeep',
    label: 'AIG Deep Pattern',
    kind: 'prediction',
    endpoint: '/api/pattern-prediction',
    predictionMode: 'Deep',
  },
  { value: 'AI', label: 'AI Pattern' },
  { value: 'ThreeTouch', label: '3-Touch Pattern' },
  { value: 'Sequence', label: 'Sequence Pattern' },
  { value: 'Cross', label: 'Cross Pattern' },
  { value: 'Weekly', label: 'Weekly Row Pattern' },
  { value: 'Monday', label: 'Monday Pattern' },
  { value: 'Tuesday', label: 'Tuesday Pattern' },
  { value: 'Wednesday', label: 'Wednesday Pattern' },
  { value: 'Thursday', label: 'Thursday Pattern' },
  { value: 'Friday', label: 'Friday Pattern' },
  { value: 'Saturday', label: 'Saturday Pattern' },
  { value: 'Sunday', label: 'Sunday Pattern' },
]

export const individualPatternOptions = patternOptions.filter((option) => option.value !== 'All')
export const allPatternOptions = individualPatternOptions
export const panelPatternOptions = individualPatternOptions.filter((option) => option.kind !== 'prediction')
export const predictionPatternOptions = individualPatternOptions.filter((option) => option.kind === 'prediction')
