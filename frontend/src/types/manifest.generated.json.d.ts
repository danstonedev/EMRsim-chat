// Ambient module typing for the generated animations manifest JSON
// Allows importing './manifest.generated.json' without @ts-ignore
declare module '*.generated.json' {
  const value: { files: string[] }
  export default value
}
