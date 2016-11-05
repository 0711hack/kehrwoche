#!/usr/bin/env bash

set -e

VERSION=$(git rev-list --all --count)
export AWS_DEFAULT_REGION=eu-west-1

npm install

rm -rf dist
mkdir dist

zip -r dist/kehrwoche-poller.zip index.js data.wsdl node_modules

aws s3 cp dist/kehrwoche-poller.zip s3://taimos-lambda-public-eu-west-1/kehrwoche-poller-${VERSION}.zip

STACKNAME=kehrwoche-poller

if ! aws cloudformation describe-stacks --stack-name ${STACKNAME} > /dev/null; then
    aws cloudformation create-stack --capabilities CAPABILITY_IAM --stack-name ${STACKNAME} --template-body file://cfn.yaml --parameters ParameterKey=Version,ParameterValue=${VERSION}
else
    aws cloudformation update-stack --capabilities CAPABILITY_IAM --stack-name ${STACKNAME} --template-body file://cfn.yaml --parameters ParameterKey=Version,ParameterValue=${VERSION} || echo "No Update"
fi

cfn-tail ${STACKNAME}

