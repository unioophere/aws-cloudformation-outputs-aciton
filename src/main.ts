import * as core from '@actions/core'
import * as aws from 'aws-sdk'

const clientConfiguration = {
  customUserAgent: 'aws-cloudformation-outputs-for-github-actions'
}

export type Inputs = {
  [key: string]: string
}

export async function run(): Promise<void> {
  try {
    const cfn = new aws.CloudFormation({...clientConfiguration})

    const stackName = core.getInput('stack-name', {required: true})

    const result = await cfn
      .describeStacks({
        StackName: stackName
      })
      .promise()

    if (!result.Stacks?.length) {
      throw new Error(`Cannot find stack with name ${stackName}`)
    }

    const {Outputs: outputs} = result.Stacks[0]
    if (!outputs) {
      core.info('no outputs')
      return
    }

    for (const output of outputs) {
      if (output.ExportName) {
        core.info(`${output.ExportName}: ${output.OutputValue}`)
        core.setOutput(output.ExportName, output.OutputValue)
      }
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
