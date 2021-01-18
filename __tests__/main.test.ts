import {run, Inputs} from '../src/main'
import * as path from 'path'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as aws from 'aws-sdk'

jest.mock('@actions/core')
jest.mock('fs')

const mockTemplate = `
AWSTemplateFormatVersion: "2010-09-09"
Metadata:
    LICENSE: MIT
Parameters:
    AdminEmail:
    Type: String
Resources:
    CFSNSSubscription:
    Type: AWS::SNS::Subscription
    Properties:
        Endpoint: !Ref AdminEmail
        Protocol: email
        TopicArn: !Ref CFSNSTopic
    CFSNSTopic:
    Type: AWS::SNS::Topic
Outputs:
    CFSNSTopicArn:
    Value: !Ref CFSNSTopic
`

const mockDescribeStacks = jest.fn()
jest.mock('aws-sdk', () => {
  return {
    CloudFormation: jest.fn(() => ({
      describeStacks: mockDescribeStacks
    }))
  }
})

describe('Deploy CloudFormation Stack', () => {
  const inputs: Inputs = {
    'stack-name': 'my-stack-name'
  }

  beforeEach(() => {
    jest.clearAllMocks()

    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return inputs[name]
    })

    process.env = Object.assign(process.env, {GITHUB_WORKSPACE: __dirname})

    jest.spyOn(fs, 'readFileSync').mockImplementation((pathInput, encoding) => {
      const {GITHUB_WORKSPACE = ''} = process.env

      if (encoding != 'utf8') {
        throw new Error(`Wrong encoding ${encoding}`)
      }

      if (pathInput == path.join(GITHUB_WORKSPACE, 'template.yaml')) {
        return mockTemplate
      }

      throw new Error(`Unknown path ${pathInput}`)
    })
  })

  test('fail on describe function error', async () => {
    mockDescribeStacks.mockReset()
    mockDescribeStacks.mockImplementation(() => {
      const err: aws.AWSError = new Error(
        'The stack does not exist.'
      ) as aws.AWSError
      err.code = 'ValidationError'
      throw err
    })
    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(1)
  })

  test('sets the stack outputs as action outputs', async () => {
    mockDescribeStacks.mockReset()
    mockDescribeStacks.mockImplementation(() => {
      return {
        promise(): Promise<aws.CloudFormation.Types.DescribeStacksOutput> {
          return Promise.resolve({
            Stacks: [
              {
                StackId:
                  'arn:aws:cloudformation:us-east-1:123456789012:stack/myteststack/466df9e0-0dff-08e3-8e2f-5088487c4896',
                Tags: [],
                Outputs: [
                  {
                    ExportName: 'hello',
                    OutputValue: 'world'
                  },
                  {
                    ExportName: 'foo',
                    OutputValue: 'bar'
                  }
                ],
                StackStatusReason: '',
                CreationTime: new Date('2013-08-23T01:02:15.422Z'),
                Capabilities: [],
                StackName: 'MockStack',
                StackStatus: 'CREATE_COMPLETE'
              }
            ]
          })
        }
      }
    })
    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(0)
    expect(mockDescribeStacks).toHaveBeenCalledTimes(1)
    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: inputs['stack-name']
    })
    expect(core.setOutput).toHaveBeenCalledTimes(2)
    expect(core.setOutput).toHaveBeenNthCalledWith(1, 'hello', 'world')
    expect(core.setOutput).toHaveBeenNthCalledWith(2, 'foo', 'bar')
  })

  test('sets the stack empty outputs as action outputs', async () => {
    mockDescribeStacks.mockReset()
    mockDescribeStacks.mockImplementation(() => {
      return {
        promise(): Promise<aws.CloudFormation.Types.DescribeStacksOutput> {
          return Promise.resolve({
            Stacks: [
              {
                StackId:
                  'arn:aws:cloudformation:us-east-1:123456789012:stack/myteststack/466df9e0-0dff-08e3-8e2f-5088487c4896',
                Tags: [],
                Outputs: [],
                StackStatusReason: '',
                CreationTime: new Date('2013-08-23T01:02:15.422Z'),
                Capabilities: [],
                StackName: 'MockStack',
                StackStatus: 'CREATE_COMPLETE'
              }
            ]
          })
        }
      }
    })
    await run()

    expect(core.setFailed).toHaveBeenCalledTimes(0)
    expect(mockDescribeStacks).toHaveBeenCalledWith({
      StackName: inputs['stack-name']
    })
    expect(core.setOutput).toHaveBeenCalledTimes(0)
  })
})
