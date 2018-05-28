# ETDB-downloads :: User manual

The goal of this manual is to let users of ETDB to easily download files from the ETDB-Caltech.

## Install

This application is a command-line application in `nodejs` and in this tutorial we will assume that the user is in a some sort of `unix` related environment.

### Install nodejs.

The easiest way to install nodejs is by using `nvm` or [Node Version Manager](https://github.com/creationix/nvm).

From their github page you can install nvm by doing:

```bash
$ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
```

you might need to close your terminal and reopen, but the next time you type `nvm` you should see a menu with options. Please refer to google if you have trouble to install `nvm`.

...and that was probably the hardest part, because now you can install `node 9.10.1` with:

```
$ nvm install  9.10.1
```

and make it the default:

```
$ nvm alias default 9.10.1
```

You should be all set and if so, you will be able to do this:

```bash
$ node
> 2 + 2
4
> 
```

Hit Ctrl-d to get out.

## Installing ETDB-downloads

ETDB-downloads is on npm under the name [etdb-downloads](https://www.npmjs.com/package/etdb-bulk-downloads) and to install simply:

```
$ npm install -g etdb-downloads
```

you should be all set. You can test it using:

```
$ etdb-downloads -h
```

and something like this should come up:

![](./imgs/2018-05-25-161306_1218x376_scrot.png)

## Using ETDB-downloads.

> Important note: ETDB is a large database, so be aware that ETDB-downloads might fill up your disk with data if you are not paying attention.

ETDB uses the [Open Index Protocol](https://oip.wiki) to deposit the metadata of the tomograms in the [FLO blockchain](https://flo.cash) and the [IPFS](https://ipfs.io) to store the data. The metadata is organized according to the OIP `artifact` for tomograms and you can find this info [here](https://oip.wiki/Research-Tomogram). We will need this information to be able to write a file that contains the parameters to select the tomograms we want to download. All these fields are accessible to the search parameter but what we are probably more interested is in the section `artifact.details`

ETDB-downloads uses another package called [`complex-filter`](https://www.npmjs.com/package/complex-filter) to process the `searchParamenter` file. Please refer to the documentation of [`complex-filter`](https://www.npmjs.com/package/complex-filter) for the details on how we can build very complicated search requirements.  

So, let's suppose we would like to download all the tomograms from _Pseudomonas aeruginosa_. To do that, we will have to pass as argument a file containing the following text:

```json
[
  {
    "type": "filter",
    "searchOn": "artifact.details.speciesName",
    "searchType": "exact",
    "searchFor": "Pseudomonas aeruginosa"
  }
]
```

In short, this is a parameter type `filter` that will `searchOn` `artifact.details.speciesName` field for an `exact` match with the `Pseudomonas aeruginosa` string.

Now, save this file as `Ps.aer.searchPar.json` in the same directory you would like to run `etdb-downloads` and then run.

```
$ etdb-downloads Ps.aer.searchPar.json
```

you should see something like this:  
![](./imgs/2018-05-25-162113_1057x284_scrot.png)

The first thing `etdb-downloads` does is to start an IPFS server for you. Then it will spawn a node, initialize a repository if needed and the start the IPFS node. Then, it will load the metadata of the tomograms and check to see if any of the requested files have been downloaded and if yes, `etdb-downloads` will not download them again.

After all that, `etdb-downloads` should retrieve the tomogram metadata from OIP and select only tomograms from _Pseudomonas aeruginosa_. `etdb-downloads` alerts you that there are 89 datasets with a total of 689 files and a total of 359.53 GB to download. If you answer `YES` to this question, ETDB will start downloading all of them.

Please, take a moment to search around the [ETDB-Caltech](https://etdb.caltech.edu) and test a couple search conditions using the `Advanced search`, however, `complex-filter` allows for a more complex association of `AND`, `OR` and `NOT` than the current `Advanced search` feature in the website.

Despite the search paramenters, `etdb-downloads` has other optional flags that might be very useful.

### --directory

We can pass this flag to tell `etdb-downloads` where we would like our data to be stored. There are two good reasons to pass this flag: 
1) It will build this directory for us if we didn't yet
2) It will avoid to download the same files again, if the download gets interrupted for any reason.

to keep going with our example, let's add `--directory Ps.aer`

### --fileType option

The default of ETDB-downloads is to download all the files from the dataset. We can change that by using the options `--fileType`. You can pick one or more of the following:

| File types allowed for download |
|:-:|
| TiltSeries |
| Reconstructions |
| Images |
| Videos |
| Others |
| None |

For example, let's say that we are only interested in the raw tilt series and the reconstructions. We should then do:

```
$ etdb-downloads Ps.aer.searchPar.json --directory Ps.aer --fileType TiltSeries Reconstructions
```

![](./imgs/2018-05-25-164518_1055x283_scrot.png)

which leads to less files but with still a large amount of data to download.

If you are unsure, I would recommend to first download only the metadata by picking `None` in `--fileType`.

> Note that `None` have precedence to any other type of files and it will ignore other types. Think as a _dry run_ option.

### --threads

The IPFS can handle multiple download threads at once. With this flag, we can pass any integer higher than 0 co concurrent downloads. `etdb-downloads` will start a new download everytime one of the threads ends until there are no more files to be downloaded.


## Important nodes

This is an experimental project. This program will likely hang, break and throw messages that won't make much sense. The best thing to do is to kill the process (Ctrl-C) and restart.

If you would like to contribute to this project, please file an issue [here](https://github.com/theJensenLab/etdb-bulk-downloads/issues) and we will try to get to it as soon as possible.

If you are a developer, please consider to contribute to the codebase by forking the project and sending a pull request. 






