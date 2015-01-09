#!/bin/bash

baseDir=$(cd "$(dirname "$(test -L "$0" && readlink "$0" || echo "$0")")"; pwd)

getProxyPid() {
  local id=$(ps -ef | grep 'node ' | grep  'index.js' | grep -v grep | awk '{print $2}')
  if [ -z "$id" ]; then
    id=0
  fi
  echo $id
}

endProxy() {
  local proxypid=`getProxyPid`

  if [ $proxypid -gt 0 ];then
    kill -9 $proxypid;
    echo 'Proxy stoped'
  fi
}

case $1 in
  start)
    endProxy;
    node $baseDir/index.js &
    echo 'Proxy starting'
    ;;
  stop)
    endProxy;
    ;;
  tail)
    tail -f $baseDir/runtime/logs/visit.log;
    ;;
  tailerror)
    tail -f $baseDir/runtime/logs/visit.log| grep 'Error: ';
    ;;
  status)
    if [ $(getProxyPid) -gt 0 ]; then
      echo 'Proxy running';
    else
      echo 'Proxy Not running';
    fi
    ;;
  *)
    echo 'available ops: start, stop, tail, tailerror, status';
esac
