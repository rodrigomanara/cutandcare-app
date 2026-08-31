<?php


try {
     require __DIR__ . '/bootstrap.php';
}catch (\Exception | \Throwable $e){
    echo $e->getMessage();
    echo $e->getFile();
}
