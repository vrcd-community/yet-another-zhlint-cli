import path from 'node:path'
import { format } from 'node:util'
import { readFile } from 'node:fs/promises'
import { env } from 'node:process'

import { glob } from 'glob'

import chalk from 'chalk'
import CliTable3 from 'cli-table3'
import { program } from 'commander'

import { readRc, Result, runWithConfig } from 'zhlint'

import * as core from '@actions/core'

program
  .name('yet-another-zhlint-cli')
  .description('Yet another zhlint CLI')
  .version(process.env.npm_package_version ?? 'snapshot')

program
  .argument('<file-pattern>')
  .option('--config <config-file>', 'specify the configuration file', '.zhlintrc')
  .option('--file-ignore, --ignore <ignore-config-file>', 'specify the ignore configuration file', '.zhlintignore')
  .option('--case-ignore <case-ignore-config-file>', 'specify the case ignore configuration file', '.zhlintcaseignore')
  .option('--dir <dir>, --workdir <dir>', 'specify the directory to lint', '.')
  .option('--fix [file-pattern]', 'fix all possibly found errors')
  .option('--github-actions', 'enable GitHub Actions annotations')
  .option('--output')

program.parse()

const options = program.opts()

const loggerConsole: Console = {
  ...console,
  log: (message, ...optionalParams) => {
    console.log(`${chalk.blue('[zhlint:readRc()]')} ` + format(message, optionalParams))
  },
}

const ignoreConfigFile = options.ignore as string
const caseIgnoreConfigFile = options.caseIgnore as string
const configFile = options.config as string
const workdir = options.dir as string
const inGithubAction = env.GITHUB_ACTIONS ?? options.githubActions as boolean

const filePattern = program.args[0]

const config = readRc(workdir, configFile, ignoreConfigFile, caseIgnoreConfigFile, loggerConsole)

const files = await glob(filePattern, { cwd: workdir })

const results: { filePath: string, rawContent: string, lintResult: Result }[] = []
const lintFails: { filePath: string, error: unknown }[] = []

for (const file of files) {
  const filePath = path.resolve(path.join(workdir, file))

  try {
    const rawContent = await readFile(filePath, 'utf-8')
    const lintResult = runWithConfig(rawContent, config)

    results.push({ filePath, lintResult, rawContent })
  }
  catch (error) {
    console.error(chalk.red('[Error]') + ' failed to lint ' + chalk.underline.bold('%s'), filePath)
    console.error(error)

    lintFails.push({ filePath, error })
  }
}

const resultTable = new CliTable3({
  chars: {
    'top': '', 'top-mid': '', 'top-left': '', 'top-right': '',
    'bottom': '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
    'left': '', 'left-mid': '', 'mid': '', 'mid-mid': '',
    'right': '', 'right-mid': '', 'middle': ' ',
  },
  style: { 'padding-left': 0, 'padding-right': 0, 'compact': true },
  colWidths: [10, 10],
})

const validations: { filePath: string, message: string, startPosition: Position, endPosition: Position }[] = []

// Process validation results & generate table items
results.map(({ filePath, lintResult, rawContent }) => {
  if (lintResult.validations.length > 0) {
    resultTable.push([])
    resultTable.push([{ content: chalk.underline(filePath), colSpan: 3 }])
    resultTable.push(...lintResult.validations.map((validation) => {
      const errorStartPosition = getPosition(rawContent, validation.index)
      const errorEndPosition = getPosition(rawContent, validation.index + validation.length)

      validations.push({ filePath, message: validation.message, startPosition: errorStartPosition, endPosition: errorEndPosition })

      return [
        chalk.gray(`  ${errorStartPosition.line.toString()}:${errorStartPosition.column.toString()} `),
        chalk.yellow('problem '),
        chalk.bold(validation.message),
        chalk.gray(validation.target),
      ]
    }))
  }
})

console.log(resultTable.toString())

const totalProblemCount = results.map(result => result.lintResult.validations.length).reduce((acc, curr) => acc + curr, 0)

console.log()
if (totalProblemCount) {
  console.log(chalk.bold.yellow(`⚠️ ${totalProblemCount.toString()} problems found\n  you can try to fix them with \`--fix\` option`))
}

if (lintFails.length) {
  console.log(chalk.bold.red(`✖ ${lintFails.length.toString()} files failed to lint`))
}

if (totalProblemCount || lintFails.length) {
  console.log()
}

if (inGithubAction) {
  core.startGroup('Generate annotations')

  validations.forEach(({ filePath, message, startPosition, endPosition }) => {
    core.warning(message, { file: filePath, startLine: startPosition.line, startColumn: startPosition.column, endLine: endPosition.line, endColumn: endPosition.column, title: 'problem' })
  })

  lintFails.forEach(({ filePath, error }) => {
    core.error(format(error), { file: filePath })
  })

  core.endGroup()
}

process.exitCode = totalProblemCount || lintFails.length ? core.ExitCode.Failure : core.ExitCode.Success

function getPosition(content: string, index: number): Position {
  let line = 1
  let column = 1
  for (let i = 0; i < index; i++) {
    if (content[i] === '\n') {
      line++
      column = 1
    }
    else {
      column++
    }
  }

  return { line, column }
}

interface Position {
  line: number
  column: number
}
