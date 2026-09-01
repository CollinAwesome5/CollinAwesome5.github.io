# This game is about typing as fast as you can!
# We are going to implement a queue to types words in order
# you have to type quickly or you'll lose!
# the code is a little messy, but I left a bunch of comments to help explain
# try to read them all so you know which code is missing and needs to be added

import pygame as pg
from pygame.locals import QUIT
import sys
import random as r
import my_dict

# define our class for the "enemies"
class Enemy:
    def __init__(self, word):
        # this word is going to be the word you have to type
        self.redText = word.lower()

        # replace this with your own image
        image = pg.image.load("red ball.png")

        self.image = pg.transform.scale(image, (20, 20))
        self.rect = self.image.get_rect()
        self.rect.x = 0
        # this text are the letters of the word the player has typed
        self.greenText = ""
    def check_word(self, letter):
        # here we are using a queue
        if letter == self.redText[0]:
            # ^ if the first letter of the red text is the letter that is typed
            self.greenText += letter
            # then add that letter to the aleady typed letters
            self.redText = self.redText[1:]
            # remove the first element (pop!) of the red text
            # ADD SOUND EFFECT?
        if len(self.redText) == 0:
            # if the red text is empty then the letters have all been typed
            # ADD SOUND EFFECT?
            return False
        return True
    def draw(self, surface):
        # change the y, by knowing our place in the queue we can have them
        # load(?) from top to bottom... instead of ontop of one another
        self.rect.y = 100 + (60 * queue.index(self))
        # define our text image
        rt = font.render(self.redText, True, "red")
        # change the location of the text using a rect
        # the red text should be on the right of the green text
        # you can mess with this if you want, but its so ugly I dont want to
        rtRect = rt.get_rect()
        rtRect = pg.Rect(self.rect.center[0],# rtRect.width, 
                         self.rect.center[1]-rtRect.height-20, 
                         rtRect.width, rtRect.height)
        gt = font.render(self.greenText, True, "green")
        # same thing for the green text, were going to offset the x by the width of the 
        # green rect so we can have it on the left of the red text
        gtRect = gt.get_rect()
        gtRect = pg.Rect(self.rect.center[0]- gtRect.width,
                         self.rect.center[1] - gtRect.height-20, 
                         gtRect.width, gtRect.height)
        #blit them onto the surface
        surface.blit(rt, rtRect)
        surface.blit(gt, gtRect)
        # move toward the player!
        self.rect = self.rect.move(1,0)
        surface.blit(self.image, self.rect)
        # if we've touched the player the game is over! (we return false)
        if self.rect.x >= 600:
            return False
        return True

#initialize!
pg.init()
font = pg.font.Font(None, 18)

#
# INITIALIZE MIXER HERE!!!!!!
#

# set the size of our window
width, height = 640, 480
DISPLAYSURF = pg.display.set_mode((width, height))

pg.display.set_caption('Type to Survive!')
DISPLAYSURF.fill("black")

# make an empty List to be the queue!!!!!
# the queue will be filled with enemies!!!!

# ^^^ DO NOT FORGET THE QUEUE 

#timer to spawn ememies
# we could use the pygame timers for this, but this seemed easier at the time
my_timer = 0
# we are stating seconds at 1 so we dont divide by 0 trying to find the wpm
seconds = 1
minutes = 0
# there are 60 frames in 1 second!
frames = 0
# this number will increase as the game goes on!
difficulty = 1
total_words = 0

# the dude we are trying to protect!
# REPLACE WITH YOUR IMAGE
dude = pg.image.load("player.png")
dude = pg.transform.scale(dude, (80, 80))

while True:

    DISPLAYSURF.fill("black")

    for event in pg.event.get():
        if event.type == QUIT:
           pg.quit()
           sys.exit()
        if event.type == pg.KEYDOWN:
            #print(chr(event.key))
            letter = chr(event.key)
            if  #??? you figure it out lmao
                #^^^^^if our queue is not empty ( use the len() function
                # to check if the queue you made is empty)
                if not .check_word(letter):
                    # work on the first element of the queue!
                    # the queue is full of enemies so we use their function to check 
                    # if they are done beign worked on!


                    
                    # if they are done being worked on get rid of them!
                    # use the pop() function
                    # every list has access to this function
                    # the argument is the index of the element to be removed
                    # dont forget FIFO!
                    total_words += 1
                    # increment the words completed

    # this bit of code chooses a random number and depending on the result
    # it will pick a length of word for our enemy
    if my_timer <= 0:
        diff = r.randint(0, 36)
        if(diff < 5):
            word = my_dict.easy[r.randint(0, len(my_dict.easy))]
        elif(diff < 15):
            word = my_dict.medium[r.randint(0, len(my_dict.medium))]
        elif(diff < 30):
            word = my_dict.hard[r.randint(0, len(my_dict.hard))]
        else:
            word = my_dict.long[r.randint(0, len(my_dict.long))]
        my_timer = r.randint(120,180)
        #HERE

        #ADD AN ENEMY TO THE QUEUE
        # we use append() to place an element at the end of a list!

    my_timer -= 1 * difficulty
    # this line changes how fast new enemies are created
    frames += 1
    # this is our ghetto timer, so we increment it

    if frames == 60:
        # 60 frames = 1 second
        frames = 0
        seconds +=1

    # change the difficulty at set times
    if seconds == 30 and minutes == 0:
        difficulty = 2
    if minutes == 1:
        difficulty = 3
    if minutes == 2:
        difficulty = 4

    if seconds == 60:
        # 60 seconds = 1 minute, duh
        minutes += 1
        seconds = 0
    
    # blit our score and the time
    DISPLAYSURF.blit(font.render((str(minutes) + ":" + str(seconds)),True,"black", "white"), (100, 30))
    DISPLAYSURF.blit(font.render("score: " + str(total_words/(minutes + seconds/60)),
                                 True,"black", "white"), (300, 30))
    # blit the dude to protect
    DISPLAYSURF.blit(dude, (570, 70))

    for # for each element in the queue!
        if not #call the function to draw that element!
            # if the enemy has reached the dude
            # quit the game
            pg.quit()
            sys.exit()

    # 60 frames a second
    pg.time.Clock().tick(60)
    # update the frame
    pg.display.update()
    

