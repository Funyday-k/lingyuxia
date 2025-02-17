---
title: 'Athena++'
date: 2022-08-14
permalink: /posts/2022/08/blog-post-1/
tags:
  - 2022
  - Fall
---

# Athena++

Prof: Suoqing Ji
Year: 2022, Fall
type: Paper

经过一个暑假的学习与实践，大概的对利用Athena++进行数值模拟有了一个初步的认识，所以，通过这个文档来总结一下所学所为，当然，毕竟是初步的学习，所以了解有限。

---

## **0.简单的List**

我觉得有必要List一下这个假期我干了什么...

- 学习使用athena++，包括编译、配置输入文件的参数、利用Vislt和yt读取生成的HDF5文件
- 选择Jet项目进行了模拟，分别用Vislt和yt可视化工具做出了图像，并初步的学习了有关的流体力学的知识，并简单的分析了Jet的发展的结构。
- 简陋的了解了一点流体力学的知识。
- 学习《黑洞系统的吸积与喷流》一书，大概了解了黑洞的吸积的原理，以及如何提取黑洞的能量并将其转化为喷流的能量的机制

除此之外，在之后我应该干的事情也应该列举一下，否则不知应该怎么努力

- 继续学习《黑洞系统的吸积与喷流》一书，对于活动星系核有一个比较general的理解，之后才能更具体地去了解怎样做数值模拟地工作
- 继续学习流体力学的知识，这是数值模拟最根本的理论基础
- 学会如何使用yt去分析进行数值分析
- 学会如何利用python将HDF5产生的可视化的图片制作成视频而不依靠Vislt

---

## **1.数值模拟工具——athena++**

![Athena++的logo](_posts/2022-09-20-blog-post-3/pic/athena_logo_temporary.png)

Athena++的logo

### **1.1 一个初步的介绍**

Athena是一个由Stone教授于2008年基于C语言开发的高阶数值模拟程序，其更侧重于MHD问题的数值模拟。而Athena++又是重新利用C++开发的新一代数值模拟代码，与早期版本相比，Athena++ 代码具有

1. 更灵活的坐标和网格选项，包括自适应网格细化
2. 包括广义相对论在内的新物理学
3. 显着提高了性能和可扩展性
4. 提高了源代码清晰度和模块化

### **1.2 如何使用Athena++代码**

首先直接搜索Athena++是有一个链接的[网址](https://www.athena-astro.app/)

![4.jpg](_posts/2022-09-20-blog-post-3/pic/4.jpg)

在Documentation一栏会跳转到[Github上的项目](https://github.com/PrincetonUniversity/athena/wiki), 这便是一个大概的教程吧, 当然我个人觉得其中有些讲得并不详细,让我在前期造成了很大困难

![5.jpg](_posts/2022-09-20-blog-post-3/pic/5.jpg)

第一步是，我们要获取代码。

> 这里我们建议使用Linux系统或者MacOS，当然个人目前是使用的MacOS系统，因为相比Linux系统配置更加方便
> 

这里我们先以MacOS为例，当我们拿到一台Mac时，一无所有，我们需要下载一个好用的编辑器[VScode](https://code.visualstudio.com/)（Pycharm也可，如果直接用Vim也不是问题...）

然后，打开终端

![这，就是终端！](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-22ce87b25f2d12f586a920a030a05af0_1440w.png)

这，就是终端！

我们先要安装一个非常实用的包管理器[Homebrew](https://brew.sh/index_zh-cn)，网站会告诉你如何安装

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

当你安装好之后，就可以使用Homebrew去安装你想要的东西了，而使用Homebrew安装的方式是

```bash
brew install xxxx
```

当你安装好一个东西后，它会统一放在固定的目录 **/usr/local**

如果你想查看你目前都安装了些什么稀奇古怪的东西，可以使用指令

```bash
brew list
```

![由于我使用的是zsh的终端，所以看起来可能不太一样](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-7c1116fcb5b3e15bdedf0942cd4e1222_1440w.png)

由于我使用的是zsh的终端，所以看起来可能不太一样

接下来，我们需要确认电脑是否安装了Git

```bash
git --version
```

如果安装了Git，就会有

![v2-40d08382f9fa950456032d03b87818a2_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-40d08382f9fa950456032d03b87818a2_1440w.png)

如果没有安装Git就按照之上的brew的方法去安装Git（如果安装失败，可以试试科学上网或者更换国内的镜像源）

现在，我们已经安装好了Git和Homebrew了，可以开始下载我们需要的东西了

首先就是代码本身了，我们需要回到Github的那个项目上去，然后点击Code一栏

![v2-855596cb07d5d8d4b8a0dcbc54ee553a_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-855596cb07d5d8d4b8a0dcbc54ee553a_1440w.png)

然后，我们就能看见这整一个代码的文件了

![v2-933f02aefa05140417f6ab3110a8d3cf_1440w.jpeg](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-933f02aefa05140417f6ab3110a8d3cf_1440w.jpeg)

那我们怎么获取整个代码项目呢？我们先点击绿色的 Code 里面就会有一个链接

![https://picx.zhimg.com/80/v2-7356b35b47b262f21304d4dca7262b26_1440w.jpeg?source=d16d100b](https://picx.zhimg.com/80/v2-7356b35b47b262f21304d4dca7262b26_1440w.jpeg?source=d16d100b)


有了这个链接我们就可以将这个项目利用Git下载下来了，具体的指令是

```bash
git clone https://github.com/PrincetonUniversity/athena.git
```

同时，如果我们需要更新这个代码，可以直接输入以下指令

```bash
git pull
```

这时候，我们在终端输入List指令，即可查看到Athena的文件夹

```bash
ls
```

![v2-4429859070148a30e9b70e94502e908a_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-4429859070148a30e9b70e94502e908a_1440w.png)

为了查看这个文件夹里的文件，我们可以选择转到这个文件里，即cd指令

```bash
cd athena
```

然后再使用ls指令就可以查看到athena文件夹里的文件了

![v2-9ce9f9c242439409b88d16772c87fd05_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-9ce9f9c242439409b88d16772c87fd05_1440w.png)

好了，我们现在已经把Athena项目下载好了，那我们该下载相关的环境了

首先需要确认的是python环境，使用指令

```bash
python3 -v
```

来确认是否安装了python以及python的版本，如果安装了会显示

![v2-167b004621febb39950b7b3595943774_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-167b004621febb39950b7b3595943774_1440w.png)

同时我们也进入了python的交互式的界面（就是那个>>>），可以按Ctrl+D退出交互式界面

我们要求的python版本需要大于3.6即可

之后我们输入以下指令

```bash
brew install gcc open-mpi hdf5-mpi
```

这是安装的三个东西分别是

- gcc 编译器
- open-mpi 并行计算库
- HDF5 一种存储计算结果的格式的库（注意要安装—mpi版本即并行计算版本）

这是三个最基本的环境

首先，我们需要进行测试，来知道我们的环境是否满足运行athena++，输入指令来跳转到有测试文件的文件夹

```bash
cd tst/regression
```

然后运行python文件（由于版本问题，运行python文件的时候需要输入python3而不是python）

```bash
python3 run_tests.py
```

而对于初上手的电脑，大概是要报错的，因为这些python文件时需要很多库才可以运行的，比如numpy、h5py等

因此我们需要根据报错内容来安装相应的库（这里找不到报错的示例了...）对于python3的库我推荐使用pip包管理工具，我们需要先确认是否有pip，输入指令

```bash
pip3 -V
```

如果安装了pip3终端会显示其版本，如果没有安装pip3终端会显示一条指令让你先安装pip3

当我们安装好pip3之后，输入以下指令来安装需要的python库

```bash
pip3 install xxxx
```

其实和brew一样的，也可以输入list来查看我们都安装了哪些库

这里我们大概的列一下运行代码需要的python库

- h5py
- matplotlib
- mpmath
- numpy
- pandas
- Pillow
- scipy
- yt(这个库不是运行必须的但后续的数据分析会需要它)

当我们安装好以上的python库之后，再运行一下测试文件看是否报错，如果没有报错就万事大吉了，如果有报错还是看看报错的提示再处理

接下来我们就可以运行程序了，对于Athena++这个代码，想要解决一个问题的大致的操作流程是

- 设置编译的初始条件
1. 指定问题生成器（这个之后会细讲）
2. 是否考虑狭相、广相条件；是否使用HDF5格式输出...
3. 开始编译，并生成二进制的编译文件
4. 指定输入文件（其中包括问题的具体初始条件）
5. 开始计算、得到计算文件

接下来我们一步一步的进行讲解

设置编译的初始条件：这一步骤是由一个python文件configure.py实现，我们首先可以输入以下指令来知道初始的编译条件都有哪些

```
python3 configure.py -h
```

我们会得到如下列表

![v2-bef3af2fa9da27b9da07f64f3beb0bc9_1440w.jpeg](_posts/2022-09-20-blog-post-3/pic/v2-bef3af2fa9da27b9da07f64f3beb0bc9_1440w.jpeg)

其中必不可少的选项是指定问题生成器，即在编译的时候需要加如下后缀

```
python3 configure.py --prob xxxx
```

- -prob之后的xxxx是问题产生器的名称，那什么是问题产生器呢？其是这个项目会给你提供一些典型的流体力学、MHD等物理情景来供你进行测试，而你可以利用给你提供的既定的物理情景进行修改来去解决你想要解决的问题，或者你也可以自己编写问题产生器来解决特殊情景的问题

目前我们只需要了解如何使用既定的问题产生器即可，其都统一存放在了地址**/src/pgen**中

![https://picx.zhimg.com/80/v2-7f7fd1ed3c3331cb4e06fde329eb2375_1440w.png?source=d16d100b](https://picx.zhimg.com/80/v2-7f7fd1ed3c3331cb4e06fde329eb2375_1440w.png?source=d16d100b)

这些文件都是给定的问题产生器，至于是什么物理情景，我们可以点进去查看其描述，这里以jet.cpp为例，我们使用VScode打开这个文件来查看（其实在VScode中打开athena文件夹进行操作也可）

![v2-d337456df6bf2b0d3df8e05892140fc1_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-d337456df6bf2b0d3df8e05892140fc1_1440w.png)

于是我们就可以在注释里知道

> Sets up a nonrelativistic jet introduced through L-x1 boundary(left edge)
> 

即设置了一个从左边界引入的一个非相对论射流，接下来我们就用这个物理情景来模拟一下射流

首先我们要回到athena文件下，输入指令

```bash
cd ..
```

即退回到上一级文件夹，当回到athena文件夹后，开始进行设置编译环境，输入如下指令

```bash
python3 configure.py --prob jet -mpi -hdf5
```

按一下回车，即可完成设置编译条件，并显示你当前的设置，这里需要提前说明一下，有些时候直接输入-hdf5的时候，在接下来编译的时候很有可能会显示没有找到HDF5库，这里我们需要指定HDF5库的安装位置，即

```bash
python3 configure.py --prob jet -mpi -hdf5 --hdf5_path=xxxx
```

至于安装地址，可以利用

```bash
brew list hdf5-mpi
```

来查询hdf5-mpi的安装位置

![v2-e5d63d91f63efdee2b2a1bc7625ebd4c_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-e5d63d91f63efdee2b2a1bc7625ebd4c_1440w.png)

接下来我们开始编译，先输入

```bash
make clean
```

如果这里说没有下载make工具可以按照提示的指令进行按照，然后再重复上述步骤

![这里是删除之前的编译文件](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-82a64b94e2cd7fde409cea822d915d13_1440w.png)

这里是删除之前的编译文件

接下来就可以进行编译了，输入

```bash
make -j
```

这里的-j是指利用多核编译，默认是单核，所以-j速度会快

于是就开始进行编译了

![v2-5d113941d6e98c66db820ac86553f65e_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-5d113941d6e98c66db820ac86553f65e_1440w.png)

上图就是编译成功了，这样在地址**/bin**中会生成一个二进制的可执行的文件**/bin/athena**

这个时候，我们就需要输入文件了，而与给定的问题生成器对应的输入文件都存放在地址**/inputs**中，而目前我们需要的输入文件是**/inputs/hydro/athinput.jet**而这个文件我们也是可以查看的

![v2-985299952405b522a69d1e3d4c520900_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-985299952405b522a69d1e3d4c520900_1440w.png)

![v2-469893a6fda11839873a62cb042f937f_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-469893a6fda11839873a62cb042f937f_1440w.png)

这些就是输入文件的内容，其中在<output2>中的file_type我们需要改成hdf5格式，否则是默认vtk格式，而对于不同的格式有什么特点，这里简单的列一下

- VTK（Visualization Tool Kit）是数值模拟中常用的标准数据格式。可以使用各种可视化软件轻松可视化，例如[VisIt](https://visit.llnl.gov/)和[ParaView](http://www.paraview.org/)。文件扩展名为.vtk
- Athena++ 可以输出根据 HDF5（分层数据格式）标准格式化的文件。这种格式最适合用于网格细化的模拟。它还具有使用并行 IO 的优势，这意味着多个进程可以写入单个文件，在与 GPFS 等并行文件系统一起使用时可以很好地扩展。此输出在每个输出时间步生成两个文件：.athdf和.athdf.xdmf.该.athdf文件是 HDF5 并包含数据。(.athdf.xdmfeXtensible Data Model and Format) 文件是一个辅助文件，其中包含对存储在.athdf文件中的数据结构的描述。当使用 VisIt 或 ParaView 可视化结果时使用此文件。此外，[yt](http://yt-project.org/)还支持 Athena++ HDF5 输出。

我们再来简单地看一下输入文件的内容

首先对于<mesh>一栏就是网格的设置，比如：

- nx1：x1维的网格数量
- x1max&x1min：x1维的最大值和最小值
- ix1_bc & ox1_bc:x1的两边的边界条件其中user是指自定义的边界条件 outflow是指流出 reflecting是指反射

这里注意到nx3=1时，就是二维问题

对于<hydro>一栏就是流体的性质，这里给出的参数是泊松比

对于<problem>就是和user密切相关了，比如

- djet：喷流的直径
- pjet：喷流的压强
- vxjet：喷流初始的x方向的速度
- bx:初始x方向的磁场

知道了初始条件后，我们就可以进行运算了，我们不妨先新建一个文件夹在这存放生成的HDF5文件

```bash
mkdir prob
cd prob
```

接下来就可以进行运算了

```bash
~/athena/bin/athena -i ~/athena/inputs/hydro/athinput.jet
```

于是就开始了漫长的计算过程了（这里略）

当我们计算完成后，就会得到HDF5的计算文件，接下来我们就需要对其进行可视化了，这里我们有好几个方法，比如使用Vislt软件，Vislt是比较方便的，但是上限不高，对于之后的数据分析的需求很难满足；所以这里更推荐使用python的库yt

![9.jpg](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/9.jpg)

关于相关的教程，你可以从官网的文档里学习到，这里我们用一个简单的代码展示一下

```python
import yt

ds = yt.load("xxxxxxx")#你想要可视化的HDF5文件
p = yt.ProjectionPlot(ds, "z", "density")#z是你所在观察轴；density是显示密度的图像
p.save()
```

这样，我们就可以得到由yt生成的图像，当然我们也可以加上矢量图

```python
import yt

ds = yt.load("xxxxxxx")#你想要可视化的HDF5文件
p = yt.ProjectionPlot(ds, "z", "density")#z是你所在观察轴；density是显示密度的图像
p.annotate_velocity()
p.save()

```

我们就可以得到了一张漂亮的图像

![v2-beeca23962068d17aa1040f67a33aa25_1440w.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-beeca23962068d17aa1040f67a33aa25_1440w.png)

![这是一个考虑狭义相对论的喷流](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/v2-93a16e8887006695a9a29a048c9e3379_1440w.png)

这是一个考虑狭义相对论的喷流

同时也可以写一个循环，把所有的HDF5文件利用yt生成出来，然后制作成movie

当然对于简单的测试，我们可以利用Vislt，直接选择一系列的HDF5文件来直接得到动画和图片

![{F4B3EFB1-E73D-E363-7B61-3876574B5163}.png](https://funyday-k.github.io/lingyuxia//_posts/2022-09-20-blog-post-3/pic/F4B3EFB1-E73D-E363-7B61-3876574B5163.png)

喷流的模拟

---

这大概是整个上手Athena++的一个流程吧