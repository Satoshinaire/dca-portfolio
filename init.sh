#!/bin/bash
#
# chkconfig: 35 99 99
# description: Node.js my daemon

. /etc/rc.d/init.d/functions

EXEC_NAME="node_my_daemon"
EXEC_USER="foouser"

NODE_BIN="/usr/local/bin/node"
NODE_SCRIPT="/home/foouser/daemon.js"

LOG_FILE="/var/log/${EXEC_NAME}.log"
PID_FILE="/var/run/${EXEC_NAME}.pid"
LOCK_FILE="/var/lock/subsys/$EXEC_NAME"

RETVAL=0


start() {
    echo -n $"Starting $EXEC_NAME: "

    daemon --user $EXEC_USER --pidfile $PID_FILE "$NODE_BIN $NODE_SCRIPT -d"
    RETVAL=$?
    PID=`cat_pid`

    echo
    [ $RETVAL -eq 0 ] && touch $LOCK_FILE && echo $PID > $PID_FILE
    return $RETVAL
}

stop() {
    echo -n $"Stopping $EXEC_NAME: "

    killproc -p $PID_FILE $EXEC_NAME
    RETVAL=$?

    echo
    [ $RETVAL -eq 0 ] && rm -f $LOCK_FILE
    return $retval
}

cat_pid() {
    PID=`ps -aefw | grep node | grep $NODE_SCRIPT | grep -v " grep " | awk '{print $2}'`
    echo $PID
}


ulimit -n 12000

case "$1" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        stop
        start
        ;;
    status)
        status -p $PID_FILE $EXEC_NAME
        RETVAL=$?
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        RETVAL=1
esac

exit $RETVAL
